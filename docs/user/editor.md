# The editor

This page grows as the editor does. It covers projects, chapters, and nodes and connections so far.

## Projects

A project is one script. Every project belongs to a team.

- **Make one:** open the team, type a name under **Projects** and choose **New project**. Any member can do this.
- **Open one:** choose its name. The editor opens with one chapter, `Chapter 1`.
- **Rename one:** in the editor, double-click the project name at the top of the left panel, type, and press Enter.
- **Move to trash:** only the team owner sees **Move to trash** next to a project. The project leaves the list. (The trash screen, to restore or delete for good, comes later.)
- **Delete the team:** deleting a team also deletes its projects. The question names how many: `Delete this team and its 2 projects?`

If you open a project you are not allowed to see (a link from someone else's team, or a project that no longer exists), the editor says so and offers **Back to teams**. It shows nothing of the project.

## Chapters

A project is split into chapters. Each chapter has a **tab** above the canvas and a row in the **Chapters** list on the left.

- **Add a chapter:** **Add chapter** in the left panel. It is named `Chapter 3` (and so on) and goes after the last one.
- **Rename:** double-click its name in the list, type, and press Enter. Escape cancels.
- **Change the order:** the `⋯` menu on a tab has **Move left** and **Move right**. The order is saved and everyone on the team sees it.
- **Resize a tab:** drag the thin bar on the right edge of the tab. This is only how *you* see the tabs; it is not saved.

### Closing a tab is not deleting a chapter

| | Close (`×` on the tab) | Move to trash (in the list) |
|---|---|---|
| What happens | The tab is hidden **for you, until you reload** | The chapter is removed for everyone |
| The chapter | Still in the list; click it to bring its tab back | Gone from the tabs and the list, with its nodes |
| Saved | No, only your view | Yes |

Moving a chapter to the trash asks you to confirm.

## Nodes and connections

The middle of the editor is the **canvas** of the open chapter: a dotted surface you can pan (drag the empty canvas) and zoom (mouse wheel, or the `+` and `−` buttons in the corner).

- **Make a node:** double-click an empty spot. A node called `New node` appears there.
- **Connect two nodes:** drag from the small dot on the right edge of one node to the dot on the left edge of another. Connecting the same two nodes twice does nothing. A node can also connect to itself.
- **Move nodes:** drag a node. To move several, hold Shift and drag a box around them (or Ctrl-click each, ⌘-click on a Mac), then drag one of them. The new place is saved when you let go.
- **Move to trash:** select one or more nodes and press Delete or Backspace. Their connections are hidden with them (the trash screen, to bring a node back, comes later). Select a connection and press Delete to remove it for good.

Each node shows its title, its colour, its first three lines (`+2 more` when there are more) and, for a link into another chapter, a tag such as `→ Chapter 2: The Door`.

### Start, End and Unreachable

Badges on a node show where it sits in the story:

| Badge | Means |
|---|---|
| **Start** | The story begins here. The first node made in a project becomes the start node. To change it, select one node and choose **Make start node** in the panel on the right. |
| **End** | No connection leads out of this node. (A connection to itself counts as leading out.) |
| **Unreachable** | No connection from another node leads into it, and it is not the start node, so a player can never get here. |

Links between chapters count: a node whose only way in is from another chapter is not unreachable. If the start node is moved to the trash, the project has no start until you mark one, and the canvas says `No start node: select a node and choose "Make start node".`

### The minimap

The small map in the corner shows the whole chapter; drag in it to move around. **Hide minimap** above the canvas hides it, and **Show minimap** brings it back. The choice is saved with your account, so it follows you to every project and browser.

## Writing the script

Select one node and the panel on the right shows it:

- **Title** and **Colour** (eight swatches) of the node, and **Make start node** (or `This is the start node.`).
- **Script:** one row per line, each with a **Character** (who speaks; leave it empty for an action such as `They wave.`) and the **line** itself. **Add line** adds one at the end.
  - While you type a character's name, the field suggests names already used in this project (most used first). Names that differ only in capitals count as one.
  - **Enter** in a line adds a new line below it and puts the cursor there. **Shift+Enter** starts a new paragraph inside the same line.
  - **Backspace** in a line whose character and text are both empty deletes it and moves the cursor to the line above.
  - **Move up** and **Move down** change the order; **Delete line** removes one.
- **Cues:** notes for sound, light or anything else, each with a type (`audio`, `lighting`, `other`) and a note. **Add cue**, **Move up**, **Move down** and **Delete cue** work as for lines. (Attaching sound or video files comes later.)

Select a connection instead and the panel shows its **Choice text** (the words a player picks to follow it, shown on the arrow) and **Delete connection**. Select several nodes and it shows how many, with **Move to trash**.

**When text is saved:** about a second after you stop typing, when you leave the field, and at once when you select something else, open another chapter or project, or leave the page. Only the field you changed is sent, so a teammate editing another field of the same node keeps their change. If you try to close or reload the page while a change is still on its way, the browser asks you first.
