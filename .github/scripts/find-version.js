const findNextVersion = (tags, branch) => {
  const version = findMostRecentVersion(tags);
  if (branch.startsWith("feature/")) {
    // It's a minor feature.

    // If the previous version was a full release or a patch dev release,
    // we are a completely new minor dev release.
    // Otherwise, the previous version was itself a minor dev release,
    // and we can reuse its number.
    if (version.preRelease == null || version.patch !== 0) {
      version.minor += 1;
      version.patch = 0;
      version.preRelease = null
    }
  } else {
    // It's a patch.

    // If the previous version was a full release,
    // we are a completely new patch dev release.
    // Otherwise, we can simply reuse the previous version's number.
    if (version.preRelease == null) {
      version.patch += 1;
    }
  }

  version.preRelease ??= 0;
  version.preRelease += 1;
  return version;
};

const findMostRecentVersion = (tags) => {
  const versions = findAllVersions(tags);
  if (versions.length === 0) {
    throw new Error("unable to find a valid version on current edge tag");
  }
  return versions[0];
};

const findOutdatedVersions = (tags, recentTag) => {
  const recentVersion = parseVersion(recentTag);
  if (recentVersion == null) {
    throw new Error(`recent tag '${recentTag}' is not a version number`);
  }
  const versions = findAllVersions(tags);
  return versions.filter(
    (version) =>
      // Select all pre-releases that appear before the most recent one.
      version.preRelease != null && compareVersions(recentVersion, version) > 0
  );
};

const findAllVersions = (tags) => {
  return tags
    .map(parseVersion)
    .filter((it) => it != null)
    .sort((a, b) => compareVersions(a, b) * -1);
};

const SEMANTIC_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-dev\d+)?$/;
const parseVersion = (tag) => {
  if (!SEMANTIC_VERSION_PATTERN.test(tag)) {
    return null;
  }
  const [major, minor, patch, preRelease] = tag.split(/[.\-]/);
  return {
    major: parseInt(major),
    minor: parseInt(minor),
    patch: parseInt(patch),
    preRelease: preRelease && parseInt(preRelease.substring(3)),
  };
};

const compareVersions = (a, b) => {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }
  if (a.preRelease !== b.preRelease) {
    if (a.preRelease == null) {
      return 1;
    }
    if (b.preRelease == null) {
      return -1;
    }
    return a.preRelease - b.preRelease;
  }
  return 0;
};

const makeVersionTag = ({ major, minor, patch, preRelease }) => {
  const tag = `${major}.${minor}.${patch}`;
  if (preRelease == null) {
    return tag;
  }
  return `${tag}-dev${preRelease}`;
};

module.exports = {
  findNextVersion,
  findMostRecentVersion,
  findOutdatedVersions,
  makeVersionTag,
};
