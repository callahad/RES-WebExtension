# Experimental port of the Reddit Enhancement Suite to WebExtensions

> WARNING: This repo frequently rewrites history as upstream patches land.

> NOTE: This is completely unofficial, unstable, and unsupported. Use at your own risk.

## Information

This is based on a snapshot of RES that may not be up to date. See the comment on [this commit](https://github.com/callahad/RES-WebExtension/commit/upstream) for more information regarding the upstream version.

[Bug 1208765](https://bugzilla.mozilla.org/1208765) contains a list of bugs that need to be fixed for upstream RES to work without modification.

See all of [my changes compared to upstream](https://github.com/callahad/RES-WebExtension/compare/upstream...master).

For more info on WebExtensions, Firefox's new Chrome-compatible add-on API, see https://wiki.mozilla.org/WebExtensions

## Building

> Note: You must be using a Nightly or Developer Edition build of Firefox with `xpinstall.signatures.required` set to `false` in `about:config`.
> WebExtensions are still VERY experimental; Nightly builds are recommended.

1. Clone this repo
2. Run make
3. Drag the resulting `RES.xpi` file into Firefox and click "Install."
