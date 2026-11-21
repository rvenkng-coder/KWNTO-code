# The editor

This page grows as the editor does. It covers projects, chapters, and nodes and connections so far.

## Projects

A project is one script. Every project belongs to a team.

- **Make one:** open the team, type a name under **Projects** and choose **New project**. Any member can do this.
- **Open one:** choose its name. The editor opens with one chapter, `Chapter 1`.
- **Rename one:** in the editor, double-click the project name at the top of the left panel, type, and press Enter.
- **Move to trash:** only the team owner sees **Move to trash** next to a project. The project leaves the list and appears under **Trash** below it (see "Trash" below).
- **Delete the team:** deleting a team also deletes its projects. The question names how many: `Delete this team and its 2 projects?`

If you open a project you are not allowed to see (a link from someone else's team, or a project that no longer exists), the editor says so and offers **Back to teams**. It shows nothing of the project.

## Chapters

A project is split into chapters. Each chapter has a **tab** in the bar above the canvas. The bar works like the page tabs in draw.io: `≡` at the start, the tabs, and `+` at the end.

- **Add a chapter:** `+` at the end of the tabs. It is named `Chapter 3` (and so on), goes after the last one and opens at once.
- **Rename:** double-click the tab's name, type, and press Enter. Escape cancels. Or open the tab's `▾` menu and choose **Rename**.
- **Change the order:** the `▾` menu on a tab has **Move left** and **Move right**. The order is saved and everyone on the team sees it.
- **See every chapter:** `≡` at the start of the bar lists all chapters, including those whose tab you closed. The open one is in bold. Choose one to open it (its tab comes back if it was closed).
- **Resize a tab:** drag the thin bar on the right edge of the tab. This is only how *you* see the tabs; it is not saved.

Every menu opens above the canvas, next to its button, and stays inside the window; a list longer than the window scrolls inside itself. Escape, a click anywhere else, resizing the window or scrolling the tabs closes it.

### Closing a tab is not deleting a chapter

| | Close (`×` on the tab) | Move to trash (in the tab's `▾` menu) |
|---|---|---|
| What happens | The tab is hidden **for you, until you reload** | The chapter is removed for everyone |
| The chapter | Still in the `≡` list; choose it to bring its tab back | Gone from the tabs and the `≡` list, with its nodes |
| Saved | No, only your view | Yes |

Moving a chapter to the trash asks you to confirm. If it was the open chapter, its neighbour opens.

## Nodes and connections

The middle of the editor is the **canvas** of the open chapter: a dotted surface you can pan (drag the empty canvas) and zoom (mouse wheel, or the `+` and `−` buttons in the corner).

- **Make a node:** choose the **Add node** button (the `+` at the top of the tool strip, left of the canvas). A node called `New node` appears with its top-left corner at the centre of what you see on the canvas, and it is selected, so the panel on the right shows it. Choosing it again puts the next node 40 px right and down, so it does not hide under the first. The button is greyed out while no chapter is open. Or double-click an empty spot: the node goes there.
- **Connect two nodes:** drag from the `+` at the bottom of a node's right edge to the dot on the left edge of another node. This makes a new **choice** (see below). A node can also connect to itself.
- **Move nodes:** drag a node. To move several, hold Shift and drag a box around them (or Ctrl-click each, ⌘-click on a Mac), then drag one of them. The new place is saved when you let go.
- **Move to trash:** select one or more nodes and press Delete or Backspace. Their connections are hidden with them; **Undo** brings the nodes back with their connections (the trash screen comes later). Select a connection and press Delete to remove it.

Each node shows its title, its colour, its first three lines (`+2 more` when there are more), up to two cues, and one row for each of its choices.

### Choices

A **choice** is something a player can pick at a node, such as `Open the door`. Each choice is a row on the node, with its own dot on the right edge. A choice may have no target yet: write it first, link it later.

- **Make a choice:**
  - drag from the `+` at the bottom of the node to another node: the choice is made already linked, with no text (the row reads `Untitled` until you name it); or
  - select the node and choose **Add choice** in the panel on the right. It is made empty and its text box is ready to type in.
- **Write it:** the choice's **Choice text** box in the panel. The same text is on the row.
- **Link or re-link:** drag the choice's own dot to another node, or choose **Link** (**Re-link** when it already leads somewhere) in the panel, then click the target node. A banner says `Select a target node`; Esc, a click on empty canvas or opening another chapter cancels it. The choice keeps its text and its place in the list.
- **Unlink:** **Unlink** in the panel empties the target again. The row stays and its dot turns hollow.
- **Delete:** **Delete** next to the choice. **Undo** brings it back.
- **One choice per target:** a node cannot have two choices to the same node. Trying shows `This node already has a choice to <title>.` and changes nothing. A node can have any number of empty choices.
- **Order:** choices are listed in the order they were made, on the node and in the panel. If you delete a choice and then undo, it returns to its place now, but after a reload it is listed last.
- A choice to a node in another chapter shows as a tag such as `→ Chapter 2: The Door` (click it to jump there) and has no line.

An empty choice does not lead anywhere, so a node whose choices are all empty is an **End**.

### Cues on the card

Under the script lines a node shows its first two cues, each marked `Audio`, `Light` or `Other`, then `+N more`. They are for the crew; the player does not see them.

### The tool strip

A narrow strip left of the canvas holds six tools. Hover a tool or Tab to it to read its tooltip.

| Tool | Does | Keys (⌘ on a Mac) |
|---|---|---|
| Add node | Adds a node at the centre of the canvas | or double-click the canvas |
| Cut | Copies the selected nodes and moves them to the trash, as one undo step | Ctrl+X |
| Copy | Copies the selected nodes | Ctrl+C |
| Paste | Pastes them into the open chapter (greyed until something is copied or cut) | Ctrl+V |
| Move to trash | Moves the selected nodes to the trash | Delete |
| Area select | On: dragging on empty canvas draws a box that selects the nodes inside; off: it pans | or Shift+drag |

### Hiding the project panel

The button at the far left of the tab bar hides or shows the left panel (Back to teams and the project name), so the canvas gets the width. Your choice is remembered in this browser. The panels scroll on their own when they are long; the page never scrolls.

### Start, End and Unreachable

Badges on a node show where it sits in the story:

| Badge | Means |
|---|---|
| **Start** | The story begins here. The first node made in a project becomes the start node. To change it, select one node and choose **Make start node** in the panel on the right. |
| **End** | No linked choice leads out of this node (empty choices lead nowhere). A choice to itself counts as leading out. |
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
- **Cues:** notes for sound, light or anything else, each with a type (`audio`, `lighting`, `other`) and a note. **Add cue**, **Move up**, **Move down** and **Delete cue** work as for lines.
- **Media:** attach audio, video and images to a node. Audio and video play in place with player controls, and images show as thumbnails (see [Media](#media) below).

- **Choices:** one block for each choice of the node, in the order the card shows them. Each has its **Choice text**, a status (`Linked → <target>` or `Not linked`), **Link** or **Re-link**, **Unlink** (when linked) and **Delete**. **Add choice** adds an empty one. **Link to another chapter** (below) adds a choice to a node elsewhere.

Select a connection (a line) instead and the panel shows its **Choice text** (the words a player picks to follow it, shown on the arrow) and **Delete connection**. Select several nodes and it shows how many, with **Move to trash**.

**When text is saved:** about a second after you stop typing, when you leave the field, and at once when you select something else, open another chapter or project, or leave the page. Only the field you changed is sent, so a teammate editing another field of the same node keeps their change. If you try to close or reload the page while a change is still on its way, the browser asks you first.

## Undo, copy and shortcuts

**Undo** and **Redo** (above the canvas, or the keys below) step back and forward through your own changes in this project: renames, colours, moves, lines, cues, connections, chapters and trashing. A drag of several nodes, trashing a selection and a paste are one step each. The last 100 steps are kept while the project is open; closing it clears them.

Undo never overwrites a teammate's work. If someone else has changed the same thing since, that step is skipped and you see `Can't undo: someone else changed this since.` (or `Can't redo: …`); the next undo goes further back.

**Copy and paste:** select nodes and copy them; paste puts copies, with their lines, cues and the connections between them, into the open chapter. Each paste of the same copy lands 40 px further right and down. You can paste into another chapter or another project in the same browser tab.

| Keys (⌘ on a Mac) | Does |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z or Ctrl+Y | Redo |
| Ctrl+X | Cut the selected nodes (copy, then move to the trash) |
| Ctrl+C | Copy the selected nodes |
| Ctrl+V | Paste into the open chapter |
| Delete or Backspace | Move the selected nodes to the trash, or delete the selected connection |
| Ctrl+K | Search |
| Ctrl+A | Select every node in the chapter |

While you type in a field, only Ctrl+K is the editor's; the other keys work as usual in the field (Ctrl+Z there undoes your typing).

## Trash

Projects, chapters and nodes you move to the trash stay there for 30 days (the admin can change this), then they are removed for good together with their lines, cues and media files. A choice that pointed at a removed node stays, with no target.

- **Chapters and nodes:** open `≡` (All chapters) at the start of the chapter bar and choose **Trash** (the last item). Each row shows the chapter or node, how long is left (`30 days left`, `1 day left`, `Removed tonight`) and **Restore**. Restoring is an ordinary edit, so **Undo** reverses it, and it also works offline.
- **A node of a trashed chapter** says `Restore the chapter <title> first.`: restore the chapter and the node comes back with it.
- **Projects:** the team owner sees a **Trash** section under the projects list, with **Restore** for each trashed project. Members do not see it.
- The time counts from when the server received the change, not from your computer's clock. A node you trash while offline starts its 30 days when you are back online.

## Export and import a project

A project can be saved to a file and made again from it, in this team or another one (for a backup, to move a project, or to keep a copy before a big change).

- **Export:** in the editor, choose **Export project file** under the project name in the left panel. The browser saves `<project name>.kwnto.json`. It is plain text you can open in any editor: the project name, its chapters, nodes (title, colour, place), script lines, cues and choices. It holds nothing internal (no team, accounts or versions). Things in the trash are left out, and so are the media files: only their names and kinds are listed, so an imported project has no media.
- **Import:** on the team's page, under the projects list, choose **Import project** and pick a `.json` file. Any verified member of the team can do this. A new project named `<name> (imported)` is made and opens. The original is not changed, and you can import the same file again for another copy.
- **If the file is refused:** the page says why, for example `This file is not a KWNTO project: format must be "kwnto-project".` or `This file is larger than the 5 MB import limit.` Nothing is created. Files must be 5 MB or smaller, with at most 200 chapters, 2,000 nodes, 20,000 lines, 10,000 cues and 10,000 choices.

## Search and links between chapters

**Search** sits in the top bar while a project is open (Ctrl+K, ⌘+K on a Mac, puts the cursor there). Type part of a node's title: capitals, accents and extra spaces do not matter, so `cafe` finds `Café Scene`. Results show `Title · Chapter`, titles that start with what you typed first. Pick one with the arrow keys and Enter, or click it: the editor opens that chapter (also when its tab was closed), selects the node and moves the canvas to it. Escape closes the list. Nodes in the trash and untitled nodes are not found.

**Link to a node in another chapter:** select a node and choose **Link to another chapter** in the panel, type part of the target's title and pick it. The link shows on the node as a tag such as `→ Chapter 2: The Door`; click the tag to jump to the target. The link is one of the node's choices, listed under **Choices** in the panel, where **Delete** removes it. A node whose only way in is such a link is not unreachable.

If the target is moved to the trash, the tag disappears (and the node may become an **End**) until the target comes back, for example with Undo.

## Working together

Everyone in the project's team can open it and write in it at the same time. What a teammate does (a new node, a line, a connection, a move, a rename, a node moved to the trash) shows on your screen as it happens, without a reload.

Two people can edit the same node at once: if you change its title while a teammate drags it, both changes are kept. Only the field each of you changed is saved, and when two saves meet, the later one is sent again on top of the first.

If very many people save the same thing at the same moment and your change still cannot get through after 20 tries, you see `Could not save: too many people are editing this at once. Try again.` Your change is taken back on your screen (nothing half-saved reaches your teammates); make it again.

**Who is editing what.** While a teammate has a field of a node selected (its title, a script line, a cue or a choice), you see `<name> is editing` under the node's title on its card and beside that field in the panel; with several people it reads `Ana and Ben are editing` or `Ana and 2 others are editing`. It goes away when they leave the field, close the project or the tab (within about 30 seconds if their browser could not say so). You never see your own name. It is a hint, not a lock: you can still edit the same field, and both changes are kept as described above. Nothing is sent while you are offline.

If the team's owner removes you from the team, the project stays on your screen until you reload or open it again; then you see `This project does not exist or you are not a member of its team.`

## Comments

Select a node and scroll to **Comments** at the bottom of its panel. Comments are listed oldest first, each with its author's name and time. Type in **Add a comment** and choose **Comment** (up to 2,000 characters; line breaks are kept). A node with comments shows a small count on its card.

- Everyone in the team sees new comments at once, without reloading, and so do people with a comment or edit link.
- You can delete your own comments, and the team owner can delete any: choose **Delete**, then confirm in the row (**Delete this comment?**). A comment cannot be edited.
- Comments are shown as plain text: anything that looks like formatting or code is shown exactly as typed.
- Comments need a connection. Offline, **Comment** is disabled (**Comments need a connection.**) and nothing is queued.
- Comments of a node go with it when the node is purged from the trash.

## Media

You can attach audio, video and images to a node. They appear in the properties panel under **Media**:

- **Allowed types:** audio (WAV, MP3), video (MOV, MP4) and images (JPEG, PNG).
- **Add media:** choose **Add media** to upload a file. The server checks the file's real type (by its first bytes, not just its extension), size limits and your quota.
- **In-place playback:** audio and video play right in the panel with controls, and images show thumbnail previews.
- **Storage belongs to the team owner.** Everything uploaded in a team's projects counts against the owner's quota, whoever uploads it. The meter shows the owner's storage (e.g. `Team storage: 1 KB of 2.0 GB used`), the same for every member. Trashed nodes still count until they are purged.
- **Remove media:** any member can choose **Remove** on an item. The panel asks first (`Remove <title> from this node? The team lead can bring it back.`). The file disappears for everyone, but it still uses the owner's storage; members cannot delete it.
- **Restore or delete for good (team owner only):** the owner sees the removed files under **Removed by the team**, and can choose **Restore** or **Delete for good** (asks first, cannot be undone). Only deleting for good frees the space.
- **Offline:** uploads require an active internet connection (the editor's own connection, so also when the top bar says `Offline` while the browser itself is online). When offline, **Add media** is disabled and a message explains that uploads need a connection. Files your teammates add or remove while you are offline show up when you are back online, without a reload.

## Working offline

You can keep writing when the connection drops. Every change is saved in your browser first and sent from there, so nothing is lost if the connection fails or you close the tab.

- **The indicator.** The top bar shows `Offline` when the browser has no connection or the live connection to the server has been down for a few seconds (even if you have not changed anything), `Offline, 3 changes waiting` when changes are waiting to be sent, and `Saving…` while they are being sent after the connection came back. When everything is saved, nothing is shown.
- **Closing the tab.** Changes that are waiting stay in your browser. Open the project again on the same browser and they are sent; they also show on your screen again on top of what your teammates did meanwhile.
- **When you come back online.** The project is loaded again, so what your teammates did while you were away appears without a reload, and your waiting changes are sent in the order you made them, at once (not after a delay).
- **When a teammate changed the same thing.** If you and a teammate changed the same thing while you were offline (for example both renamed the same node), a window opens: `Someone else changed this while you were offline`. For each thing it shows `Yours` and `Theirs`; choose `Keep mine` or `Keep theirs`. Nothing else is sent until you choose. Changes to different things (you recoloured a node, they renamed it) are merged without asking. If a teammate deleted a script line, cue or connection you changed, the window says so, and `Keep mine` puts it back with your changes.
- **A change that could not be saved.** If the server refuses a change, the top bar says `1 change could not be saved` with a `Show` button. The list gives what it was and the server's message; the change is taken back on your screen and the changes after it are still sent. `Dismiss` removes a row.
- **Undo.** While you are offline with changes waiting, Undo and Redo do nothing and say `Undo waits until you are back online and your changes are saved.` They work again as soon as the changes are saved. Changes you made offline are separate steps: after you are back online, one Undo takes back only your last change, not a whole stretch of offline work.
- **Signing out.** If changes are waiting, you are asked first: `Sign out anyway` or `Stay signed in`. If you sign out anyway, they are kept in the browser and sent the next time you sign in on this browser.
- **Shared computers.** Waiting changes are kept in the browser profile, so anyone who can open that profile can read them. On a shared computer, wait for `Saving…` to disappear before you sign out.
- **Not covered.** Pictures and other files are not queued; they need a connection.
