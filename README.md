# Experimental port of the Reddit Enhancement Suite to WebExtensions

## Information

This is based on a snapshot of [RES at 4ac07e6403de818af22d3822e460c260030e2028](https://github.com/honestbleeps/Reddit-Enhancement-Suite/commit/4ac07e6403de818af22d3822e460c260030e2028) from Wednesday, September 23rd, 2015.

[Bug 1208765](https://bugzilla.mozilla.org/1208765) contains a list of bugs that need to be fixed for upstream RES to work without modification.

See all of [my changes compared to upstream](https://github.com/callahad/RES-WebExtension/compare/d522ae38f54ccede1a96b68f75385ecf03c40171...master).

For more info on WebExtensions, Firefox's new Chrome-compatible add-on API, see https://wiki.mozilla.org/WebExtensions

## Building

> Note: You must be using a Nightly or Developer Edition build of Firefox with `xpinstall.signatures.required` set to `false` in `about:config`.
> WebExtensions are still VERY experimental; Nightly builds are recommended.

1. Clone this repo
2. Run make
3. Drag the resulting `RES.xpi` file into Firefox and click "Install."
