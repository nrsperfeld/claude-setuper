---
name: review-code
description: Reviews changed code looking for real errors before saving or publishing. Use with "review what I changed", "is this right", "/review-code".
---

Look at the diff (`git diff` and `git diff --cached`) or the files the person pointed to. Look only for what breaks or gives a wrong result: edge cases, logic errors, null data, calls that can fail without being handled. Ignore style.

For each finding, say in one line what goes wrong and in what situation, and propose the fix. If you found nothing that breaks, say so in one line and stop. Don't invent a problem to seem useful.
