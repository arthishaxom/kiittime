# Prefect 3.x: Secret Block exposure via deployment `job_variables`

**Scope:** Primary-source research (Prefect official docs + `PrefectHQ/prefect` source) into whether
`{{ prefect.blocks.secret.<slug>.value }}` references in a `prefect.yaml` deployment's
`work_pool.job_variables.env` are actually protected by Secret blocks, or whether the plaintext is
persisted into the deployment.

**Environment grounding:** This repo (`apps/analytics/prefect.yaml`) uses exactly this pattern for
`AXIOM_API_KEY`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `CF_ACCOUNT_ID`,
`ANALYTICS_WRITER_DATABASE_URL`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, deployed to a managed work
pool. `apps/analytics/uv.lock` pins `prefect==3.8.1`; source citations below are pinned to the
`3.8.1` tag where possible.

**No secret values appear in this document.**

---

## Summary (the short version)

1. Block references in the **deployment declaration** (including `work_pool.job_variables`) are
   resolved **at `prefect deploy` time on the machine running the CLI**, and the **resolved plaintext
   is sent to and stored by the Prefect API** as part of the deployment. Secret blocks protect the
   value *before deploy*, but the deployment then stores the plaintext.
2. `prefect deployment inspect` prints whatever the API returns. It does **not** re-resolve blocks at
   display time; it is dumping the stored deployment, so it shows the stored plaintext.
3. Secret block values are encrypted at rest by the Prefect backend (Fernet; Cloud uses
   workspace-unique keys). Access is gated by RBAC in Prefect Cloud (the `view_secret_block_data`
   permission, held by Developer+ by default). Self-hosted has no per-object RBAC, so anyone who can
   authenticate to the API can read all secrets.
4. The safe patterns are: load secrets **in flow/task code** (`Secret.load(...)`) or from a real
   secret manager block; keep secret references only in **`pull` steps** (the one section Prefect
   deliberately leaves unresolved until runtime); and/or inject secrets at the **worker/infrastructure
   layer** (e.g. Kubernetes `secretRef`), never through deployment `job_variables`.
5. A public code repo does **not** by itself receive the deployment `job_variables` secrets; the code
   is cloned via pull steps that keep block refs unresolved until runtime and the git clone path
   scrubs credentials. The real leak paths are: the secrets are readable from the deployment API/UI,
   they are passed into the runner/job environment, Prefect's log masking only redacts the Prefect API
   key (not arbitrary secrets), and `log_prints`/`print` of an env var will ship plaintext to the
   Prefect API.

The core problem: **the Secret block is doing its job; the deployment `job_variables` path is not a
secret store.** Once resolved at deploy time, the value is no longer "in a Secret block" from the
deployment's perspective.

---

## Q1. When is `{{ prefect.blocks.secret.<slug>.value }}` resolved — deploy time or run time? Is plaintext persisted?

**Answer: Resolved at `prefect deploy` time, and persisted in plaintext in the deployment definition
on the API server.**

Prefect's own documentation describes the two-phase behavior and explicitly contrasts the `pull`
section with the rest of the deployment declaration:

> "Next, the `pull` section is templated with any step outputs but *is not run*. Block references are
> *not* hydrated for security purposes: they are always resolved at runtime."
> "Next, all variable and block references resolve with the deployment declaration. All flags provided
> through the `prefect deploy` CLI are then overlaid on the values loaded from the file."
> — [docs.prefect.io — How to define deployments with YAML](https://docs.prefect.io/v3/how-to-guides/deployments/prefect-yaml)
> (section "Deployment mechanics"). Claim: `pull` block refs stay unresolved; every other block ref,
> including `work_pool.job_variables`, is resolved before the deployment is registered.

The source confirms this ordering. In `_run_single_deploy`, `pull` steps are captured *before*
resolution, then the **entire** deploy config is resolved:

```python
pull_steps = deploy_config.get("pull", actions.get("pull")) or []
...
deploy_config = await resolve_block_document_references(deploy_config)
deploy_config = await resolve_variables(deploy_config)
...
deployment = RunnerDeployment(..., job_variables=get_from_dict(deploy_config, "work_pool.job_variables"))
```

- [github.com/PrefectHQ/prefect `src/prefect/cli/deploy/_core.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/cli/deploy/_core.py)
  lines 91, 101–102, 394. Claim: the whole config (thus `job_variables`) is block-resolved at deploy
  time; `pull` was already snapshotted before resolution.

`resolve_block_document_references` reads the Secret block from the API and returns its literal value
(it does **not** keep a reference):

- [github.com/PrefectHQ/prefect `src/prefect/utilities/templating/__init__.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/utilities/templating/__init__.py)
  line 258 (`resolve_block_document_references`). Claim: block placeholders are replaced by the
  block's stored data/value; the docstring confirms system blocks (like `Secret`) resolve their
  `value` by default.

The client-side read requests secret material by default (`include_secrets: bool = True`), so the CLI
obtains the plaintext to substitute:

- [github.com/PrefectHQ/prefect `src/prefect/client/orchestration/_blocks_documents/client.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/client/orchestration/_blocks_documents/client.py)
  lines 101–131 (`read_block_document(..., include_secrets: bool = True)`). Claim: the SDK's default
  block read includes `SecretStr`/`SecretBytes` values.

The resolved dict is handed to `RunnerDeployment`, whose `_create` sends `job_variables` straight into
the deployment create payload:

- [github.com/PrefectHQ/prefect `src/prefect/deployments/runner.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/runner.py)
  (`RunnerDeployment._create` / `_create_sync`: `create_payload["job_variables"] = self.job_variables`).
  Claim: resolved job variables are posted to `POST /deployments/` as-is.

The API schema stores them as an untyped dict (no `SecretStr`, no obfuscation):

- [github.com/PrefectHQ/prefect `src/prefect/client/schemas/objects.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/client/schemas/objects.py)
  line ~1215 (`class Deployment`: `job_variables: dict[str, Any]`). Claim: the deployment model has no
  secret typing on `job_variables`, so values are stored/returned verbatim.

**Conclusion:** The Secret block is read, decrypted, and substituted during `prefect deploy`. The API
receives and stores the literal value in `deployment.job_variables.env`.

---

## Q2. Why does `prefect deployment inspect` show the secret values?

**Answer: Because it is dumping the stored deployment returned by the API. It is not resolving blocks
at display time.**

```python
async with get_client() as client:
    deployment = await client.read_deployment_by_name(name)
    deployment_json = deployment.model_dump(mode="json")
    ...
    _cli.console.print(Pretty(deployment_json))
```

- [github.com/PrefectHQ/prefect `src/prefect/cli/deployment.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/cli/deployment.py)
  line ~141 (`async def inspect`), lines ~204–230. Claim: `inspect` calls `read_deployment_by_name`
  and prints `model_dump()`; the only extra block resolution is for legacy
  `infrastructure_document_id`, not for `job_variables`.

Since `Deployment.job_variables` is `dict[str, Any]` (Q1 citation), the plaintext stored at deploy time
is what is rendered. `inspect` is a faithful view of the deployment, not a re-hydration.

> Note: The `include_secrets` gate that protects **Block documents** (Q3) does not apply to
> **Deployment** objects. There is no analogous `include_secrets` parameter on the deployment API.
> Once the value is a deployment `job_variable`, every principal allowed to read the deployment sees
> it.

---

## Q3. Security model of Prefect Secret blocks (Cloud and self-hosted 3.x)

### 3a. Encryption at rest

Prefect documents Secret values as encrypted at rest, and separately states that *all* block values
are encrypted before storage:

- [docs.prefect.io — How to store secrets](https://docs.prefect.io/v3/how-to-guides/configuration/store-secrets):
  "Secret values are encrypted at rest when stored in your Prefect backend."
- [docs.prefect.io — How to create custom blocks](https://docs.prefect.io/v3/advanced/custom-blocks):
  "All block values are encrypted before being stored. If you have values that you would not like
  visible in the UI or in logs, use the `SecretStr` field type ... to automatically obfuscate those
  values."
- [docs.prefect.io — Blocks concept](https://docs.prefect.io/v3/concepts/blocks):
  block schemas "allow for fields of `SecretStr` type which are stored with additional encryption and
  not displayed by default in the UI."

Implementation: Prefect server uses Fernet (`cryptography`). It prefers
`PREFECT_SERVER_ENCRYPTION_KEY` (deprecated alias `ORION_ENCRYPTION_KEY`); if that is not set it
**generates a key and stores it in the `configuration` table of the same database**:

- [github.com/PrefectHQ/prefect `src/prefect/server/utilities/encryption.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/server/utilities/encryption.py)
  (`_get_fernet_encryption`, `encrypt_fernet`). Claim: Fernet encryption; auto-generated key persisted
  in the DB unless `PREFECT_SERVER_ENCRYPTION_KEY` is provided.
- Block writes call `encrypt_data`:
  [github.com/PrefectHQ/prefect `src/prefect/server/models/block_documents.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/server/models/block_documents.py)
  (create/update paths call `orm_block.encrypt_data(session=..., data=...)`).

**Implication:** In self-hosted 3.x, encryption at rest is real but the key is (by default) in the same
database. Anyone with DB read access can decrypt. Set `PREFECT_SERVER_ENCRYPTION_KEY` from an external
secret to get key separation.

In Prefect Cloud, encryption is managed by Prefect with workspace-unique keys:

- [prefect.io/security](https://www.prefect.io/security): "Data encrypted at rest", "Workspace-unique
  encryption keys", and "Configuration blocks (encrypted per-workspace)". Claim: Cloud blocks are
  encrypted with per-workspace keys.

### 3b. Who can read them (API key scopes / workspaces / RBAC)

The Block document REST API hides secret fields unless `include_secrets=true`:

- [github.com/PrefectHQ/prefect `src/prefect/server/api/block_documents.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/server/api/block_documents.py)
  lines 62 and 115 (`include_secrets: bool = False`). Claim: secret block data is excluded by default
  from block-document API responses.

On **Prefect Cloud**, secret block visibility is a distinct RBAC permission:

- [docs.prefect.io — How to manage account roles](https://docs.prefect.io/v3/how-to-guides/cloud/manage-users/manage-roles):
  - Built-in `Viewer`: "View all blocks within a workspace" (no explicit secret-data grant).
  - Built-in `Developer`: "Create, edit, and delete all blocks and their secrets within a workspace."
  - Custom-role permission **"View secret block data"**: "User can see configured blocks and their
    secrets within a workspace."
  Claim: reading secret values requires the `view_secret_block_data` capability (Developer+ by
  default; grantable via custom roles).
- Enterprise object-level ACLs can further restrict specific blocks/deployments:
  [docs.prefect.io — How to manage Access Control Lists (ACLs)](https://docs.prefect.io/v3/how-to-guides/cloud/manage-users/object-access-control-lists):
  "ACLs are supported for blocks, deployments, and work pools"; "When an ACL is added, all users ...
  will lose access if not explicitly added."
- API keys inherit the actor's scopes/roles:
  [Prefect MCP server SECURITY.md](https://github.com/PrefectHQ/prefect-mcp-server/blob/main/SECURITY.md):
  "API-key deployments are bounded by the permissions associated with the API key."

On **self-hosted Prefect 3.x**, there is no per-object RBAC. The only built-in auth is HTTP Basic auth
(`server.api.auth_string` / `api.auth_string`), which is all-or-nothing on the API:

- [docs.prefect.io — How to secure a self-hosted Prefect server](https://docs.prefect.io/v3/advanced/security-settings):
  "API keys are only used for authenticating with Prefect Cloud ... If both `PREFECT_API_KEY` and
  `PREFECT_API_AUTH_STRING` are set ... `PREFECT_API_KEY` will take precedence ...". Claim:
  self-hosted authentication is a single shared Basic-auth credential, not per-user roles.

**Implication for this deployment:** In Cloud, a `Viewer` cannot read the Secret block directly, but
**can read the deployment** ("View deployments within a workspace") and therefore the resolved
plaintext in `job_variables`. The Secret-block RBAC is bypassed by the deployment path. In
self-hosted, there is no distinction at all: anyone with the API credential can read both.

### 3c. Any documented warning that anyone with workspace access can read secrets?

Prefect documents that job variables are visible in the UI Configuration tab (so their values are not
treated as secret):

- [docs.prefect.io — How to override job variables](https://docs.prefect.io/v3/how-to-guides/deployments/customize-job-variables):
  after deploying, "You should see the job variables in the `Configuration` tab of the deployment in
  the UI." Claim: job variable values, including any resolved secrets, are a normal visible
  deployment setting.

Prefect's templating docs recommend block references to avoid committing secrets to `prefect.yaml`
(source control), but do not claim the reference survives into the stored deployment:

- [docs.prefect.io — How to define deployments with YAML](https://docs.prefect.io/v3/how-to-guides/deployments/prefect-yaml)
  ("Templating options"): "It is highly recommended that you use block references for any sensitive
  information ... to avoid hardcoding these values in plaintext." Claim: the recommendation is about
  the *file*, not about the *registered deployment*.

Related upstream issues confirm the general class of problem (plaintext secrets flowing into
job/infrastructure manifests):

- [PrefectHQ/prefect issue #17093](https://github.com/PrefectHQ/prefect/issues/17093): "k8s worker
  base job template should always use a secret reference for ... secret env vars"; the issue shows
  `PREFECT_API_KEY` rendered as a plain env value in spawned job/pod manifests.
- [PrefectHQ/prefect issue #22300](https://github.com/PrefectHQ/prefect/issues/22300): "Kubernetes
  worker injects environment variables as plaintext in Job ...".

---

## Q4. Recommended ways to use secrets WITHOUT embedding plaintext in deployment `job_variables`

### 4a. Load secrets in flow/task code: `Secret.load(...)`

Keep only a non-sensitive identifier in the deployment; fetch the value at runtime from code running
inside the worker/job.

- [docs.prefect.io — How to store secrets](https://docs.prefect.io/v3/how-to-guides/configuration/store-secrets):
  `secret = Secret.load("name"); secret.get()`; "Secret values are encrypted at rest when stored in
  your Prefect backend."
- Reference/source: `prefect.blocks.system.Secret` in
  [github.com/PrefectHQ/prefect `src/prefect/blocks/system.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/blocks/system.py).

The runner needs `view_secret_block_data` (Cloud) or API access (self-hosted) at run time. This keeps
the value out of the deployment object entirely.

### 4b. Keep secret references only in `pull` steps (documented runtime resolution)

Prefect intentionally does **not** hydrate block references in the `pull` section; they resolve on the
worker at flow-run time, and the deployment stores the template string, not the value.

- [docs.prefect.io — How to define deployments with YAML](https://docs.prefect.io/v3/how-to-guides/deployments/prefect-yaml)
  ("Deployment mechanics", pull-action tip): block/variable references in pull steps "remain
  unresolved until runtime and are pulled each time your deployment runs. This avoids storing
  sensitive information insecurely."
- Worker-side resolution: [github.com/PrefectHQ/prefect `src/prefect/deployments/steps/core.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/steps/core.py)
  (`run_step` does `resolve_block_document_references` → `resolve_variables` → `apply_values(os.environ)`).
  The `run_steps` function serializes inputs *before* templating specifically to avoid leaking resolved
  secrets into event payloads (security comment at ~line 200). Claim: pull/step secrets resolve on the
  worker at runtime, and step events keep the template, not the value.
- Worker/base-template resolution: [github.com/PrefectHQ/prefect `src/prefect/workers/base.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/workers/base.py)
  (`from_template_and_values` calls `resolve_block_document_references(...)`). Claim: block refs in the
  base job template also resolve worker-side at flow-run time.

Limitation: pull steps are for fetching code; to populate arbitrary flow env vars from this path you
need a custom pull/step that writes a file or sets env, or you load in code (4a).

### 4c. Use a real secret manager integration instead of a Prefect Secret block

`prefect-aws` `AwsSecret`, `prefect-gcp` `GcpSecret`, Azure Key Vault, etc. fetch from your cloud
secret store at runtime, so the value never enters the deployment.

- [docs.prefect.io — prefect-aws integration](https://docs.prefect.io/integrations/prefect-aws):
  `AwsSecret` "Manages a secret in AWS's Secrets Manager."
- [docs.prefect.io — prefect-gcp integration](https://docs.prefect.io/integrations/prefect-gcp):
  `GcpSecret` "Manages a secret in Google Cloud Platform's Secret Manager."

Tradeoff: requires the runner to have IAM/identity to the secret manager; adds a runtime dependency.

### 4d. Inject at the worker/infrastructure layer (best isolation)

Put secrets in the execution platform's native secret mechanism, not in Prefect at all:

- Kubernetes base job template secret references:
  [docs.prefect.io — Customizing Base Job Templates](https://docs.prefect.io/v3/advanced/customize-base-job-templates)
  shows `envFrom: [{ secretRef: { name: ... } }]`, `valueFrom.secretKeyRef`, and `imagePullSecrets`.
  Claim: K8s secrets can be injected into flow-run pods without appearing in `job_variables`.
- Kubernetes worker can also manage the Prefect API key as a K8s secret:
  [docs.prefect.io — prefect-kubernetes worker](https://docs.prefect.io/integrations/prefect-kubernetes/api-ref/prefect_kubernetes-worker)
  (`PREFECT_INTEGRATIONS_KUBERNETES_WORKER_CREATE_SECRET_FOR_API_KEY`).
- Docker/K8s worker secret handling and `store_env_as_secret`-style settings are documented in the
  worker/helm references, e.g.
  [prefect-helm values](https://github.com/PrefectHQ/prefect-helm/blob/main/charts/prefect-worker/values.yaml):
  `cloudApiConfig.apiKeySecret` and modes like `secretRef`/`autoSecret`.

Tradeoff: platform-specific and more setup; secrets are then governed by the platform's RBAC, which is
the right place for this.

### 4e. Prefect Cloud managed deployment secrets (`prefect-cloud`)

The `prefect-cloud` CLI supports passing secrets at deploy time, either as literal values (stored as
secret blocks) or as references to existing secret blocks:

- [github.com/PrefectHQ/prefect-cloud](https://github.com/PrefectHQ/prefect-cloud):
  `prefect-cloud deploy ... --secret API_KEY=actual-secret-value` and
  `--secret API_KEY="{existing-api-key-block}"`.
- Source: [github.com/PrefectHQ/prefect-cloud `src/prefect_cloud/cli/deployments.py`](https://github.com/PrefectHQ/prefect-cloud/blob/main/src/prefect_cloud/cli/deployments.py)
  converts secrets to `"{{ prefect.blocks.secret.<name> }}"` env entries. Claim: managed deployments
  reference secret blocks rather than storing the raw value in the deploy config — but verify the
  final stored deployment still uses a reference and not a resolved value for your deployment type.

### 4f. Environment-variable indirection — **not** a fix for `job_variables`

`{{ $ENV_VAR }}` placeholders are resolved from the deploy machine's environment **at deploy time** in
the deployment declaration (same `_core.py` path: `apply_values(deploy_config, os.environ, ...)` at
line 105), so the value is still embedded in the deployment. Env-var indirection only stays late-bound
inside `pull`/step inputs (where `os.environ` is applied at runtime in `run_step`).

- [github.com/PrefectHQ/prefect `src/prefect/cli/deploy/_core.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/cli/deploy/_core.py)
  line 105. Claim: env-var placeholders in the deployment declaration resolve at deploy time.
- [github.com/PrefectHQ/prefect `src/prefect/deployments/steps/core.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/steps/core.py)
  (`apply_values(inputs, os.environ)`). Claim: env-var placeholders in step inputs resolve at runtime.

### 4g. Are `job_variables` env values visible in the UI/API to workspace users?

Yes. Values are a normal deployment attribute rendered in the UI Configuration tab
([customize-job-variables doc](https://docs.prefect.io/v3/how-to-guides/deployments/customize-job-variables))
and returned by the deployment REST API / `prefect deployment inspect` (Q2). Any role with
"View deployments" (Cloud `Viewer` and up) can read them.

---

## Q5. Public code repo + Prefect cloning: do `job_variables` secrets leak? What about log masking?

### 5a. The clone path itself is defended

Prefect's `pull`-step block references stay unresolved in the deployment and resolve only on the
worker at runtime (Q4b). The git clone implementation then deliberately avoids echoing credentials:

- [github.com/PrefectHQ/prefect `src/prefect/runner/storage.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/runner/storage.py):
  `_clone_repo` logs the **clean** URL (`self._url`), and on failure suppresses the exception chain
  when credentials are present, strips auth from URLs in stderr, and redacts known URL auth secrets
  ("Hide the command used to avoid leaking the access token"). Claim: git_clone does not intentionally
  log the token, and sanitizes error output.
- `run_steps` serializes step inputs before templating so events carry the template string rather than
  the resolved secret ([steps/core.py @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/steps/core.py), security comment ~line 200).

So a public repo alone does not cause `job_variables` to be written into the clone, and a private-repo
token in a `pull` step is not persisted in the deployment.

### 5b. The actual leak paths for `job_variables` secrets

- **Deployment API/UI:** stored plaintext is readable by anyone with deployment read access (Q2/Q4g).
- **Runner/job environment:** the worker merges `deployment.job_variables` with flow-run overrides and
  renders them into the job. See `resolve_for_flow_run` in
  [workers/base.py @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/workers/base.py)
  (`deployment_vars = getattr(deployment, "job_variables", {})`). The values become env vars / job
  manifest fields and may be visible in the platform (e.g. Kubernetes Job/Pod `env`, as reported in
  issues [#17093](https://github.com/PrefectHQ/prefect/issues/17093) and
  [#22300](https://github.com/PrefectHQ/prefect/issues/22300)).
- **Public code is not the vector; the flow's behavior is.** If the flow or any imported library does
  `print(os.environ["AXIOM_API_KEY"])` (or logs it), that plaintext is sent to the Prefect API as a log
  record. With `@flow(log_prints=True)`, prints are captured and shipped.

### 5c. Prefect log masking only covers the Prefect API key

Prefect installs exactly one log filter, and it redacts the **current Prefect API key** only:

- [github.com/PrefectHQ/prefect `src/prefect/logging/filters.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/logging/filters.py):
  `ObfuscateApiKeyFilter.filter` reads `PREFECT_API_KEY.value()` and redacts that substring from
  messages/args. Claim: no general-purpose secret-value masking exists.
- [github.com/PrefectHQ/prefect `src/prefect/logging/loggers.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/logging/loggers.py):
  "Prevent the current API key from being logged in plain text" (adds `ObfuscateApiKeyFilter`).

`SecretStr` only masks in `repr()`/object display; `Secret.load(...).get()` returns plaintext, and any
string interpolation/`os.environ` value is not masked by Prefect. So **your `AXIOM_API_KEY`,
`ANALYTICS_WRITER_DATABASE_URL`, etc. are not masked in logs if they are printed or included in an
error/traceback.**

---

## Recommendations to reduce exposure

Treat the values currently in `work_pool.job_variables.env` as **exposed** (they live in the stored
deployment and are readable by deployment readers), and rotate them.

### 1. Rotate every secret that is (or was) embedded in `job_variables`, then remove them from the deployment

- Rotate Axiom / R2 / PostHog / DB credentials, update the Secret blocks, and remove the
  `job_variables.env` secret entries.
- Verify with `prefect deployment inspect <name>` that no secret remains (remember: `inspect` shows
  exactly what is stored).
- **Tradeoff:** rotation requires coordinating every consumer; brief downtime/duplicate-credential
  window.

### 2. Load secrets at runtime in code (`Secret.load(...)`) or via a secret-manager block

- Replace env plumbing with `Secret.load("<slug>").get()` (or `AwsSecret`/`GcpSecret`) inside the flow
  bootstrap, and only pass non-sensitive config through the deployment.
- **Tradeoff:** code change; the runner principal now needs `view_secret_block_data` (Cloud) or API
  access (self-hosted); adds a runtime API call.

### 3. Stop using `job_variables` for secrets; use the two late-bound paths instead

- Use `pull` steps for clone/credentials (kept unresolved until runtime by design), and
  worker/infra-level injection (e.g. Kubernetes `secretRef`/`envFrom`, platform secret stores) for
  flow env vars.
- **Tradeoff:** platform-specific configuration; Kubernetes-only for native secret refs; more
  infrastructure setup.

### 4. Restrict read access to deployments (and blocks) and treat them as secret-bearing

- On Cloud Pro/Enterprise: keep "View deployments" limited, and use object-level ACLs for deployments
  and blocks so only trusted actors can read them. On self-hosted: front the API with an auth proxy /
  RBAC, because built-in Basic auth is all-or-nothing.
- **Tradeoff:** Cloud ACLs are Enterprise-only; self-hosted requires you to build the control plane
  (proxy + identity).

### 5. Never rely on Prefect log masking for non-Prefect secrets; scrub at the source

- Avoid printing secrets; if logging is unavoidable, wrap values in a redaction helper. Prefect only
  obfuscates `PREFECT_API_KEY`.
- **Tradeoff:** discipline/guards needed; does not protect against `repr()` of arbitrary objects or
  tracebacks—review third-party library logging too.

### Secondary caveat — avoid interactive re-save of resolved config

`prefect deploy`'s "save configuration to `prefect.yaml`" prompt serializes `deploy_config_before_templating`,
which is captured **after** block resolution. If a deployment (or secret) isn't already saved in the
target `prefect.yaml`, this can write resolved values to disk. Prefer `--no-prompt` / pre-existing
`prefect.yaml` entries, and inspect the file after any interactive deploy.

- [github.com/PrefectHQ/prefect `src/prefect/cli/deploy/_core.py` @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/cli/deploy/_core.py)
  lines 101–102, 317, 441–452; save formatting is in
  [deployments/base.py @ 3.8.1](https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/base.py)
  (`_format_deployment_for_saving_to_prefect_file`). Claim: the "before templating" snapshot is taken
  after block resolution and is what may be persisted.

---

## Citation index

| # | Source | One-line claim |
|---|--------|----------------|
| 1 | https://docs.prefect.io/v3/how-to-guides/deployments/prefect-yaml | `pull` refs stay unresolved until runtime; all other deployment-declaration refs resolve at deploy. |
| 2 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/cli/deploy/_core.py | `resolve_block_document_references(deploy_config)` then `job_variables=...` — deploy-time resolution; `pull` captured earlier. |
| 3 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/utilities/templating/__init__.py | `resolve_block_document_references` substitutes the block's literal value. |
| 4 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/client/orchestration/_blocks_documents/client.py | SDK reads blocks with `include_secrets=True` by default. |
| 5 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/runner.py | `RunnerDeployment._create` posts `job_variables` verbatim to the API. |
| 6 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/client/schemas/objects.py | `Deployment.job_variables: dict[str, Any]` (untyped, unmasked). |
| 7 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/cli/deployment.py | `inspect` prints `read_deployment_by_name(...).model_dump()` — stored data, not re-resolved. |
| 8 | https://docs.prefect.io/v3/how-to-guides/configuration/store-secrets | "Secret values are encrypted at rest ... in your Prefect backend." |
| 9 | https://docs.prefect.io/v3/advanced/custom-blocks | "All block values are encrypted before being stored"; `SecretStr` obfuscates UI/logs. |
| 10 | https://docs.prefect.io/v3/concepts/blocks | `SecretStr` fields "stored with additional encryption and not displayed by default in the UI." |
| 11 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/server/utilities/encryption.py | Fernet encryption; auto-generated key stored in DB if no `PREFECT_SERVER_ENCRYPTION_KEY`. |
| 12 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/server/models/block_documents.py | Block create/update encrypt data before storage. |
| 13 | https://www.prefect.io/security | Cloud: data encrypted at rest, workspace-unique keys, per-workspace block encryption. |
| 14 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/server/api/block_documents.py | `include_secrets` defaults to `False` on block-document endpoints. |
| 15 | https://docs.prefect.io/v3/how-to-guides/cloud/manage-users/manage-roles | Viewer vs Developer; custom permission "View secret block data". |
| 16 | https://docs.prefect.io/v3/how-to-guides/cloud/manage-users/object-access-control-lists | Enterprise ACLs for blocks/deployments/work pools. |
| 17 | https://github.com/PrefectHQ/prefect-mcp-server/blob/main/SECURITY.md | API keys/principals are bounded by their roles/scopes. |
| 18 | https://docs.prefect.io/v3/advanced/security-settings | Self-hosted auth is Basic-auth; API keys are Cloud-only. |
| 19 | https://docs.prefect.io/v3/how-to-guides/deployments/customize-job-variables | Job variables are visible in the deployment UI Configuration tab. |
| 20 | https://github.com/PrefectHQ/prefect/issues/17093 | K8s worker passes secret env vars as plaintext in job/pod manifests. |
| 21 | https://github.com/PrefectHQ/prefect/issues/22300 | K8s worker injects env vars as plaintext in Job manifests. |
| 22 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/blocks/system.py | `Secret.value: SecretStr / PydanticSecret[T]`; `get()` returns plaintext. |
| 23 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/steps/core.py | `run_step` resolves blocks/variables/env at runtime; inputs serialized before templating for events. |
| 24 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/workers/base.py | Worker resolves base-template block refs and merges `deployment.job_variables` at flow-run time. |
| 25 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/runner/storage.py | Git clone sanitizes auth from logged URLs/errors and suppresses credential-bearing exceptions. |
| 26 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/logging/filters.py | Only `ObfuscateApiKeyFilter` (the Prefect API key) is redacted from logs. |
| 27 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/logging/loggers.py | Attaches the API-key obfuscation filter; nothing masks arbitrary secrets. |
| 28 | https://docs.prefect.io/integrations/prefect-aws | `AwsSecret` block reads from AWS Secrets Manager at runtime. |
| 29 | https://docs.prefect.io/integrations/prefect-gcp | `GcpSecret` block reads from GCP Secret Manager at runtime. |
| 30 | https://docs.prefect.io/v3/advanced/customize-base-job-templates | K8s base job template supports `secretRef`/`envFrom`/`imagePullSecrets`. |
| 31 | https://github.com/PrefectHQ/prefect-cloud | `prefect-cloud deploy --secret NAME=value` or `--secret NAME="{block}"`. |
| 32 | https://github.com/PrefectHQ/prefect/blob/3.8.1/src/prefect/deployments/base.py | `_format_deployment_for_saving_to_prefect_file` does not re-hydrate block refs before saving. |

*Version note: citations pinned to Prefect `3.8.1` (the version locked in `apps/analytics/uv.lock`).
Behavior described was verified against both `3.8.1` and `main` at time of research.*
