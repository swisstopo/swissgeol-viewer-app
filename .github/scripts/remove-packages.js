const { Octokit } = require("@octokit/rest");

const removePackageVersions = async (imageUrl, imageVersions) => {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const [_imageHost, imageOwner, imageName] = imageUrl.split("/");
  const imageIds = await loadOutdatedVersionIds(octokit, imageOwner, imageName, imageVersions);
  for (const imageId of imageIds) {
    await octokit.rest.packages.deletePackageVersionForOrg({
      package_type: "container",
      package_name: imageName,
      username: imageOwner,
      package_version_id: imageId,
    });
  }
};

const loadOutdatedVersionIds = async (octokit, imageOwner, imageName, versions) => {
  let page = 0;
  versions = new Set(versions);

  const ids = new Set();
  while (true) {
    const response = await octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg({
      package_type: "container",
      package_name: imageName,
      username: imageOwner,
      page,
    });
    if (response.data.length === 0) {
      break;
    }
    for (const entry of response.data) {
      // Match any of the requested version's ids,
      // as well as any ids that do not have a tag anymore, i.e. are fully unused.
      const { tags } = entry.metadata.container;
      const matchedTags = tags.filter((tag) => versions.delete(tag));
      if (tags.length === 0 || matchedTags.length !== 0) {
        ids.add(entry.id);
      }
    }
    page += 1;
  }
  return ids;
};

module.exports = {
  removePackageVersions,
};
