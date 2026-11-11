# 1. Core Architecture & Framework
- **Node-Based Canvas:** Visual branching narrative editor designed for interactive scriptwriting and complex A/V storyboard planning.
- **Tech Stack:** Engineered with React, JavaScript (JSX), and Tailwind CSS for modular, high-performance UI rendering.


# 2. UI/UX & Aesthetics

- **Design Language:** Inspired by Apple OS and Nothing OS, prioritizing clean typography, high contrast, and a tactile interface feel.
- **Theme System:** Native support for manual Light/Dark mode toggling across all workspace components.
- **Backdrop:** Repeating dotted matrix background pattern providing dynamic spatial awareness on infinite canvas pan.
- **Snappy Animations:** Zero-latency node dragging achieved by disabling transform transitions during active movement, complemented by tactile button press feedback (active:scale-95).

# 3. Node Editor & Workspace
- **Dynamic Nodes:** Supports real-time state updates and dynamic height adjustments driven by text content volume.
- **Color Organization:** Integrated 12-tone color-coding system for node headers and borders to categorize narrative paths and logic branches.
- **Visual Connections:** Dynamic SVG connecting lines mapped between nodes to visually lay out narrative decision trees.
- **Properties Panel:** Dedicated side panel for managing line-by-line scripts, A/V cues, and local SFX asset uploads.
- **Chapter Management:** Workspace navigation with resizable and closable tabs for structuring multi-part projects.

# 4. Player Mode
- **Interactive Playback:** Integrated execution environment enabling creators to instantly playtest and validate branching narrative paths.
- **Snappy Transitions:** Custom page-turning mechanics featuring fluid slide-in and fade-in animations linked directly to the target node's unique ID.

# 5. Sharing & Cloud Data
- **Firebase Integration:** Powered by the Firebase REST API and Realtime Database/Firestore to ensure reliable persistence within sandboxed iframe containers.
- **Cloud Auto-Save:** Background synchronization automatically serializes changes to a private workspace cloud instance.
- **Share via Link:** Generates an isolated snapshot of the current state using JSON serialization encoded into a compressed URL query parameter (?share=ID), seamlessly decoded upon collaborator access.

# 6. Export Capabilities
- **Print-to-PDF:** A robust "Save to PDF" pipeline that builds a clean, standalone HTML document in a temporary window, reliably triggering the browser's native print and PDF export engine.