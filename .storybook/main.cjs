const path = require("path");

const replaceFileExtension = (filePath, newExtension) => {
  const { name, root, dir } = path.parse(filePath);
  return path.format({
    name,
    root,
    dir,
    ext: newExtension,
  });
};

module.exports = {
  staticDirs: ['./static'],
  "stories": [
    "../src/**/*.stories.mdx",
    "../src/**/*.stories.@(js|ts)"
  ],
  "addons": [
    "@storybook/addon-links",
    "@storybook/addon-essentials"
  ],
  "core": {
    "builder": "webpack5"
  },
  // this hack allows to use class field properties
  // See https://github.com/storybookjs/storybook/issues/12578#issuecomment-702664081
  babel: async (options) => {
    Object.assign(options.plugins.find((plugin) => plugin[0].includes('plugin-proposal-decorators'))[1], {
      decoratorsBeforeExport: true,
      legacy: false
    })
    return options;
  },
  // this is a hack for storybook 6.4
  // see https://github.com/storybookjs/storybook/issues/14877#issuecomment-998620943
  webpackFinal: (config) => {
    // Find the plugin instance that needs to be mutated
    const virtualModulesPlugin = config.plugins.find(
      (plugin) => plugin.constructor.name === "VirtualModulesPlugin"
    );

    // Change the file extension to .cjs for all files that end with "generated-stories-entry.js"
    virtualModulesPlugin._staticModules = Object.fromEntries(
      Object.entries(virtualModulesPlugin._staticModules).map(
        ([key, value]) => {
          if (key.endsWith("generated-stories-entry.js")) {
            return [replaceFileExtension(key, ".cjs"), value];
          }
          return [key, value];
        }
      )
    );

    // Change the entry points to point to the appropriate .cjs files
    config.entry = config.entry.map((entry) => {
      if (entry.endsWith("generated-stories-entry.js")) {
        return replaceFileExtension(entry, ".cjs");
      }
      return entry;
    });
    return config;
  },
};
