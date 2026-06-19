## TODOs towards v45

* Leftover from previous session, item 8 in the roadmap:

Start the cleanup (item 8) → do it as small, individually-committed, suite-green steps; don't rewrite everything at once.


**major: new lesson types**
  
* Please add this **new lesson type** [upload
  build_history/claude_word_forms_integration_spec.md] to prompts and
  all code. In the live UI, hide both grammar and conjugation lessons,
  and instead add this new "word forms" lesson type. Make sure it
  integrates with the current work-flow and get's meaningful input
  from the difficulty and extend/neutral/reinforce selections.  Search
  the existing codebase for: lesson type registry, prompts.json
  loading, lesson renderer UI, lesson validation code, lesson editor,
  lesson progress tracking, ..., and update all affected locations.
  Also replace grammar and conjugation lesson in the "generate all lesson
  types" function with the new "word forms" and "synonyms" (see below)
  lessons.

* "word forms" lesson: Additionally to above instructions, ask the LLM
  to also add a very short source language "explanation" field to the
  json for each question, why something is the correct choice (tenses,
  plural, conjugation, etc.) for the chosen target language.

* "synonyms/antonyms" lesson: please replace with a new version of
  this, where the word for which we look for synonyms or antonyms is
  presented in the context of a sentence (extend: from the current
  chapter, reinforce: from the story line, or previous lesson
  sentences). This should look very similar to the new "word forms"
  lesson described above, and ideally they can share the code.
  Re-use the existing "similar" and "opposite" ui entries.
* synonym editor: allow to delete the whole entry, and
  to add other synonyms, antonyms, homophones. 


**major: user flagging**

* QC and User Flagging: Allow the user of both live index.html and the
  static docs/index.html to flag individual questions, with optional
  "comment" and "correct version" fields. In static the flags can then
  be exported with the json export.  In live we treat it very similar
  to the QC flags, where the optional "correct version" field becomes
  the suggested "fix" in the lesson editor, as currently for QC. Note
  that such code had already existed and may still be there. If it is,
  be careful to not generate conflicts, and cleanly/surgically
  remove/replace the old code. 

**major: editing of static in teacher mode**

* edit mode in static: when teacher mode is selected, currently we
  unlock all lessons. I want to expand this and allow all non-LLM
  based lesson editing and flagging. The user (teacher) can then use
  the static html at github to clean out and edit lessons.  This view
  should include all QC and previously existing user flags.  In other
  words, we just strip all LLM-based functionality from the static,
  when viewed in teacher mode, but hide all edit functions in the
  non-teacher mode.

**major: learning arcs**

* Add a bottom row to the storyline page, similar to the bottom row 
  of the chapter page. It can contain a "continue story" button,
  a download button, clear progress, and delete button. We replace
  the "add lesson" button by a powerful new button "re-create all
  lessons", where we create new lessons (and keep but hide the old original
  lessons) for each chapter, using the same learning-arc logic as for
  book generation.
* Fuse form.pdf_arc and form.gen_arc_lbl entries in
  ui.json/index.html, and generally align the interface between pdf-based,
  llm story-based book generation, and the new "re-generate
  all storyline lessons" function described above.
  

**minor/cosmetics**

* i haven't tested the new TTS detection, and I don't see any warning
yet on firefix, with very bad speech.

* use the globe icon (rotating version in the top row of the main
  page, and links to main page from story/chapter pages) as a page
  title, such that it appears in the browser tabs.
  
* the number of QC-tagged questions is currently shown next to the
  button to do QC. Instead it should be shown next to the edit pencils,
  and also show user flags.

* in the lessonset/chapter page, individual lessons show a title and a
  subtitle in the row below. We should replace the subtitle by useful
  lesson info, e.g. whether it extends or reinforces vocab, and the
  difficulty level it was generated with. re-use the apt ui.json entries
  for the extend/neutral/reinforce selection of generation.

* for pdf/text/markdown upload, store the original file name with
  the storyline in lessons.json.

* editors: they should close when moving to different lessonset/chapter,
  via the navigation buttons.

* note that i changed the number of LLM math lessons, include this from
  now on in index.html:

-  const nExercises = difficulty <= 1 ? 5 : 7;
+    const nExercises = difficulty * 5;
+    //const nExercises = difficulty <= 1 ? 5 : 7;

* sorting in saved lessons is curretnly by target language, instead
  sort by source language.
  
* can we use a fs watch, as for prompts.json, also for ui.json, and 
  reload, if changed?

* clean ui.json, e.g. some just use icons, "lesson.flag_story": "⚐",
  and these can be moved to hard-coded index.html and don't need
  a ui entry. 

