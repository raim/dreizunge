
# TODOs for v46:

## BUGS

* grammar arc mode: still uses "grammar and conjugation", but that may
  be due to ui.json entries. Please list all ui.json entries that
  refer to old grammar and conjugation, while in reality using
  the new "word forms" and "synonyms" lessons.

* In the static version w/o teacher mode, lessons and stories should
  be locked before the user solved the questions. Currently, again or
  still, not all stories are locked in sl_962481837; even after
  pressing the "clear progress" button. Perhaps there is still some
  non ID-based code, and this stems from already solved lessons of the
  same "little i" story line in different languages?

## LESSON IMPROVEMENTS

* We need a plan for difficult lesson types such as word forms and
  synonyms: can we generate a set of good examples for each target
  language X each lesson type X each difficulty level, to be
  injected into the prompts. it could be based on a general topic such
  as "greetings and introductions"? 
* We could also do the previous point dynamically, and select examples
  from stories tagged as "manually curated" for the given target
  language, if present. We could add a "good example" button to
  questions, in both question card and lesson editor. It could be next
  to the "flag" button, but have no comments, just the function to tag
  each question as a good example. When generating a new story, 
  the examples can be ordered by "target language", "difficulty"
  and other properties, and the "closest" examples can be injected
  into prompts.
* We can combine both and generate a batch of basic lessons, auto-WC 
  them in several rounds, then use as training_lessons.json which
  human users can incrementally improve.
* In summary, the question is, what the most efficient strategy would
  be, with minimal human user requirement, to get good examples.
  I tend to think, we should first implement a question-wise 
  and lesson-wise rating system, parallel to the flag system. 
  And use top-rated questions as an example injection (if 
  any are found; show warning otherwise).

* The new "mixed lessons" generator should also prefer high-rated
  lessons and use non-flagged only if necessary to fill up a minimum.

* "mixed lessons": add hide, delete and sort buttons (live and static teacher mode).

## FEATURES

* in static, if a user adds flags, edits lesson questions or summary, etc.
  the should be reminded, e.g. via a permanent pill at the bottom of the
  page, that they need to export the lesson as json and upload to the github's
  "Issue" page at https://github.com/raim/dreizunge/issues/new .

* next to the UI language selectors, and below the main source language selector
  add a check mark, "fix", and if selected don't switch the UI language when
  switching to a storyline or lessonset.
  
* in the questions cards, clearly mark flagged questions; show
  the content of existing flags below the question.


* generate a markdown/html report on lessons.json: show recent edits
  of questions, lessons, lesson set/chapters, and story lines in
  temporal order. This can just be an external script for now, but we
  later want to add it to the index.html interface.
  
  
