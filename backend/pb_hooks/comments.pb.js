/// <reference path="../pb_data/types.d.ts" />
// Comments (plan 7 Task 5, D13): the author's name is copied from the account when a comment
// is made, whatever the caller sent (commenters may not read each other's accounts). The save
// is the request's own, not wrapped in a transaction of ours, so live create events are sent.

onRecordCreate((e) => {
  const author = e.app.findRecordById("users", e.record.getString("author"))
  const name = author.getString("name").trim()
  e.record.set("author_name", name === "" ? "Someone" : name)
  e.next()
}, "comments")
