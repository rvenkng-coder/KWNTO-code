# Sharing a project by link

Any team member can share a project with people outside the team by making a link. Open the project and choose **Share** in the left panel. (People who work through an edit link do not see **Share** or **Export project file**: those belong to the team.)

## Making a link

1. Under **Who can open it** choose **Can view**, **Can comment** or **Can edit**.
2. Under **Kind** choose **Live** or **Snapshot**. A snapshot is a frozen copy and can only be a view link.
3. Choose **Create link**. The new link appears in the list with its address. **Copy link** puts the address on your clipboard and says **Copied**.

Each row says what the link allows and when it was made.

## What the person who opens a link sees

| Link | Needs an account? | What they get |
|---|---|---|
| **Can view** | No | A read-only picture of the project: chapter tabs, the canvas (pan and zoom, nothing can be changed) and, when they click a node, its script lines, choices, cues and media. |
| **Can comment** | Yes, verified | The same read-only view. They are asked to sign in first and come back to the link afterwards. |
| **Can edit** | Yes, verified | The normal editor for that one project. They are not on your team: they cannot see the team, its other projects or its members, and cannot move the project to the trash or delete media for good. The project appears under **Shared with me** on their Teams page. |

A **live** view follows the project: it refreshes by itself about every 30 seconds while the tab is open, and at once when the person comes back to the tab. A **snapshot** shows the project as it was when the link was made, until you republish it.

## Commenting through a link

People with a **Can comment** link click a node in the viewer and see its comments under the node's text, with a box to add their own. They can delete their own comments. Their comments appear for the team at once, with their account name. When you revoke the link they can no longer comment, and what they wrote stays.

## When the project is in the trash

While a project is in the trash, its live links and the edit and comment access of people who already joined stop working, and it disappears from their **Shared with me** list. When the owner restores the project, they work again; nothing needs to be shared a second time. A snapshot keeps showing what it listed.

## Republishing a snapshot

Choose **Republish** on the snapshot's row. People who already have the link see the new version the next time they open or reload it.

## Revoking a link

Choose **Revoke** on the link's row. The row asks **Revoke this link? Anyone using it loses access at once.** Choose **Revoke** again to confirm, or **Cancel**. The row then reads **Revoked**.

From that moment the link shows only "This link is not valid or was revoked." for everyone, including its media. Someone who was editing through an edit link has their next change refused, and the project leaves their **Shared with me** list. A revoked link cannot be brought back: make a new one.

If a link may have leaked and you cannot tell which one, the server's admin can revoke every link at once (see the incident runbook in [security.md](../security.md)).
