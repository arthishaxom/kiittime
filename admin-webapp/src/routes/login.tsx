import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { useAuth } from "../lib/auth";

const LoginSearchSchema = z.object({
	redirect: z.string().default("/"),
});

const LoginFormSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
});

export const Route = createFileRoute("/login")({
	validateSearch: LoginSearchSchema.parse,
	beforeLoad: ({ context, search }) => {
		if (context.auth.isAuthenticated) {
			throw redirect({ to: search.redirect });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const auth = useAuth();
	const router = useRouter();
	const search = Route.useSearch();
	const [error, setError] = useState<string | null>(null);

	const form = useForm<z.infer<typeof LoginFormSchema>>({
		resolver: zodResolver(LoginFormSchema),
		defaultValues: { username: "", password: "" },
	});

	async function onSubmit(values: z.infer<typeof LoginFormSchema>) {
		setError(null);
		try {
			await auth.login(values.username, values.password);
			router.navigate({ to: search.redirect });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Login failed");
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Sign in</CardTitle>
					<CardDescription>
						Enter your credentials to access the admin panel
					</CardDescription>
				</CardHeader>
				<CardContent>
					{error && (
						<Alert variant="destructive" className="mb-6">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="flex flex-col gap-4"
						>
							<FormField
								control={form.control}
								name="username"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Username</FormLabel>
										<FormControl>
											<Input placeholder="username" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="mt-2 w-full">
								Sign in
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
