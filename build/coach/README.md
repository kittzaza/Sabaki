# build/coach

The coach engine executable is staged here before packaging, and shipped in the
installed app's `resources/coach`.

It is built from a separate repository —
[Project_Thai_Go_AI_Coach](https://github.com/kittzaza/Project_Thai_Go_AI_Coach)
— so it is not committed here; `scripts/stageCoachEngine.js` copies it in:

```
node scripts/stageCoachEngine.js
npm run dist:win64
```

The directory is staged rather than read straight out of the sibling checkout so
that a build with no coach engine available still produces an app rather than
failing on a missing path. That app registers no coach engine, and the setup
screen says so.
