# Questions that need a picture ALOC did not send

ALOC returns these questions with no image (`image` empty, `images` empty), so the app shows only the words.
They are still served as normal; add the real picture below and it appears with the question.
Found in the question bank on 10 Oct 2026:

| Subject | ALOC id | Year | Question text |
|---|---|---|---|
| Biology | 16 | 2003 | The structure can be found in the |
| Biology | 17 | 2003 | The point marked I is referred to as |
| Biology | 145 | 2006 | The variation illustrated is |
| Biology | 146 | 2006 | The change in the length of the necks of the giraffes shown was brought about by |
| Biology | 156 | 2007 | The part labeled IV is responsible for |
| Geography | 257 | 2016 | The above diagram on which the contours are in meters shows a |
| Mathematics | 371 | 2005 | The grades of 36 students in a test are shown in the pie chart above. How many students had excellent? |

The bank only holds the questions students have loaded so far, so more will turn up as it grows.

## Putting a real picture back

1. Open the same question on a past-question site (for example myschool.ng or schoolngr.com: pick the subject, "JAMB", and the year in the table), and save its diagram.
2. Save it in `public/question-images/`, for example `biology-17-2003.png`.
3. Add a line to `SUPPLEMENTS` in `src/lib/pictureSupplement.ts`:
   `{ subject: "biology", id: "17", year: "2003", image: "/question-images/biology-17-2003.png" }`
4. Deploy. The question shows with its picture.

Check that the diagram belongs to that exact question (same year, same wording): a wrong diagram is worse than none.
