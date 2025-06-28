module.exports = (api) => {
	api.cache(true);

	api.cache(true);

	return {
		presets: [
			[
				"babel-preset-expo",
				{
					jsxImportSource: "nativewind",
					unstable_transformImportMeta: true
				},
			],
			"nativewind/babel",
		],

		plugins: [
			[
				"module-resolver",
				{
					root: ["./"],

					alias: {
						"@": "./",
						"tailwind.config": "./tailwind.config.js",
					},
				},
			],
		],
	};
};
