import React, { useState, useRef, useEffect } from 'react';
import { Play, Edit, Plus, Trash2, ArrowRight, AlertCircle, Unlink, Hexagon, ChevronRight, Share2, Download, ImageIcon, Volume2, Folder, FileText, X, Menu, Sun, Moon } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, addDoc } from 'firebase/firestore';

// (1) Initialize Firebase OUTSIDE component gracefully:
const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
let app, auth, db;

try {
  if (firebaseConfigStr) {
    const firebaseConfig = JSON.parse(firebaseConfigStr);
    if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
    }
  }
} catch (e) {
  console.warn("Firebase not configured or failed to initialize:", e);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const NODE_WIDTH = 256;

const defaultProjects = [
  {
    id: 'proj-1',
    title: 'The Dark Forest',
    subsections: [
      {
        id: 'sub-1',
        title: 'Chapter 1',
        nodes: [
          {
            id: 'node-1',
            title: 'The Dark Forest',
            text: 'You stand at the edge of a dark, menacing forest. Two paths diverge in front of you.',
            avScript: 'SFX: Howling wind, distant wolves.\nVISUAL: Dim lighting, fog rolling in.',
            x: 100,
            y: 150,
            color: '#1f2937', // default dark gray
            choices: [
              { id: 'choice-1-1', text: 'Left path', targetId: 'node-2' },
              { id: 'choice-1-2', text: 'Right path', targetId: 'node-3' }
            ]
          },
          {
            id: 'node-2',
            title: 'The Bear Cave',
            text: 'You walk down the left path and stumble into a dark cave. A bear awakens!',
            avScript: 'SFX: Low, guttural growl fading into a loud roar.',
            x: 450,
            y: 50,
            color: '#7f1d1d', // red
            choices: []
          },
          {
            id: 'node-3',
            title: 'The Hidden Castle',
            text: 'The right path leads you to a magnificent hidden castle.',
            avScript: 'VISUAL: Camera pans up to reveal glowing blue spires.',
            x: 450,
            y: 280,
            color: '#1e3a8a', // blue
            choices: [
              { id: 'choice-3-1', text: 'Explore', targetId: '' }
            ]
          }
        ]
      }
    ]
  }
];

const COLORS = [
  '#1f2937', // Gray
  '#7f1d1d', // Red
  '#14532d', // Green
  '#1e3a8a', // Blue
  '#4a044e', // Purple
  '#78350f', // Brown
  '#064e3b', // Deep Teal
  '#0f766e', // Deep Cyan
  '#4338ca', // Indigo
  '#be123c', // Crimson
  '#9a3412', // Rust
  '#3f3f46'  // Zinc
];

export default function BranchingNarrativeTool() {
  const [mode, setMode] = useState('editor');
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null);
  // Project & Sidebar State
  const [projects, setProjects] = useState(defaultProjects);
  const [activeProjectId, setActiveProjectId] = useState('proj-1');
  const [activeSubId, setActiveSubId] = useState('sub-1');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // Editor State
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [connectingChoiceId, setConnectingChoiceId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // For canvas panning
  const [isPanning, setIsPanning] = useState(false);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // Player State
  const [currentPlayerNodeId, setCurrentPlayerNodeId] = useState(null);
  const [deadEndMessage, setDeadEndMessage] = useState(null);

  // (2) In first useEffect with empty deps, call auth FIRST:
  useEffect(() => {
    const initAuth = async () => {
      if (!auth) return;
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Firebase Auth Error:", e);
      }
    };
    initAuth();
    
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, setUser);
      return () => unsubscribe();
    }
  }, []);

  // Derived Active Data
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const activeSubsection = activeProject?.subsections.find(s => s.id === activeSubId) || activeProject?.subsections[0];
  const nodes = activeSubsection?.nodes || [];

  // Sidebar Resize Logic
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setSidebarWidth(newWidth);
      }
    };
    const handleGlobalMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = '';
    }
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizingSidebar]);

  // Local State Updaters & Firebase Sync
  const syncProjectsState = (newProjects) => {
    setProjects(newProjects);
    
    // Save to private user workspace in Firestore (if not viewing a shared file)
    if (user && db && !new URLSearchParams(window.location.search).get('share')) {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'workspace', 'data');
      setDoc(docRef, { projects: newProjects }).catch(err => console.error("Cloud save failed:", err));
    }
  };

  const updateNodesState = (newNodes, skipSync = false) => {
    const newProjects = projects.map(p => {
      if (p.id === activeProject?.id) {
        return {
          ...p,
          subsections: p.subsections.map(s => 
            s.id === activeSubsection?.id ? { ...s, nodes: newNodes } : s
          )
        };
      }
      return p;
    });
    
    if (skipSync) {
      setProjects(newProjects);
    } else {
      syncProjectsState(newProjects);
    }
  };

  // --- Project Management Actions ---

  const handleAddProject = () => {
    const newProjId = `proj-${Date.now()}`;
    const newSubId = `sub-${Date.now()}`;
    const newProj = {
      id: newProjId,
      title: `New Project`,
      subsections: [{ id: newSubId, title: 'Chapter 1', nodes: [] }]
    };
    syncProjectsState([...projects, newProj]);
    setActiveProjectId(newProjId);
    setActiveSubId(newSubId);
  };

  const handleAddSubsection = (e, projId) => {
    e.stopPropagation();
    const newSubId = `sub-${Date.now()}`;
    const newSub = { id: newSubId, title: 'New Chapter', nodes: [] };
    const newProjects = projects.map(p => 
      p.id === projId ? { ...p, subsections: [...p.subsections, newSub] } : p
    );
    syncProjectsState(newProjects);
    setActiveProjectId(projId);
    setActiveSubId(newSubId);
  };

  const handleDeleteProject = (e, projId) => {
    e.stopPropagation();
    const newProjects = projects.filter(p => p.id !== projId);
    syncProjectsState(newProjects);
    if (activeProjectId === projId) {
      setActiveProjectId(newProjects[0]?.id || null);
      setActiveSubId(newProjects[0]?.subsections[0]?.id || null);
    }
  };

  const handleDeleteSubsection = (e, projId, subId) => {
    e.stopPropagation();
    const newProjects = projects.map(p => {
      if (p.id === projId) {
        return { ...p, subsections: p.subsections.filter(s => s.id !== subId) };
      }
      return p;
    });
    syncProjectsState(newProjects);
    if (activeSubId === subId) {
      const proj = newProjects.find(p => p.id === projId);
      setActiveSubId(proj?.subsections[0]?.id || null);
    }
  };

  // --- Actions ---

  const toggleMode = () => {
    if (mode === 'editor') {
      setCurrentPlayerNodeId(nodes.length > 0 ? nodes[0].id : null);
      setMode('player');
    } else {
      setMode('editor');
    }
  };

  const saveToPDF = () => {
    // Generate a clean printable popup window to ensure reliable publishing export
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Pop-up blocked! Please allow pop-ups to export your script.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${activeProject.title} - Story Script Export</title>
          <style>
            body { font-family: ui-serif, Georgia, serif; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
            h1 { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 28px; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 30px; }
            .node { border: 1px solid #ccc; border-radius: 8px; padding: 24px; margin-bottom: 30px; page-break-inside: avoid; background: #fafafa; }
            .node-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 14px; font-family: ui-sans-serif, sans-serif; }
            .node-title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .node-id { font-size: 12px; color: #666; }
            .av-script { background: #eee; padding: 10px 14px; border-left: 4px solid #333; font-family: monospace; font-size: 13px; margin-bottom: 14px; white-space: pre-wrap; }
            .text { font-size: 16px; margin-bottom: 16px; white-space: pre-wrap; }
            .choices { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; font-family: ui-sans-serif, sans-serif; }
            .choices h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin: 0 0 8px 0; }
            .choices ul { margin: 0; padding-left: 20px; }
            .choices li { font-size: 14px; margin-bottom: 4px; }
            .img-preview { max-width: 250px; max-height: 150px; margin-bottom: 14px; border-radius: 4px; border: 1px solid #ccc; }
          </style>
        </head>
        <body>
          <h1>${activeProject.title} &mdash; ${activeSubsection.title}</h1>
          <div>
            ${nodes.map(node => `
              <div class="node">
                <div class="node-header">
                  <span class="node-title">${node.title}</span>
                  <span class="node-id">ID: ${node.id}</span>
                </div>
                ${node.image ? `<img class="img-preview" src="${node.image}" />` : ''}
                ${node.avScript ? `<div class="av-script"><strong>[A/V SCRIPT]:</strong>\n${node.avScript}</div>` : ''}
                <div class="text">${node.text}</div>
                <div class="choices">
                  <h4>Choices:</h4>
                  ${node.choices.length > 0 ? `
                    <ul>
                      ${node.choices.map(c => `
                        <li><strong>${c.text}</strong> &rarr; Target Node ID: ${c.targetId || 'None (Dead End)'}</li>
                      `).join('')}
                    </ul>
                  ` : '<i>Terminal Node (No choices).</i>'}
                </div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // (3) Load private user data or shared project
  useEffect(() => {
    if (!user || !db) return; // Guard for unauthenticated queries or missing DB

    const params = new URLSearchParams(window.location.search);
    const shareKey = params.get('share');

    if (shareKey) {
      // Load public shared data
      const loadSharedData = async () => {
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'shared_projects', shareKey);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().projects) {
            const decoded = docSnap.data().projects;
            setProjects(decoded);
            setActiveProjectId(decoded[0]?.id);
            if (decoded[0]?.subsections?.length > 0) {
              setActiveSubId(decoded[0].subsections[0].id);
            }
          } else {
            console.warn("Shared project not found or empty.");
          }
        } catch (err) {
          console.error("Failed to load shared project data:", err);
        }
      };
      loadSharedData();
    } else {
      // Set up onSnapshot listener for private workspace
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'workspace', 'data');
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().projects) {
          const cloudProjects = docSnap.data().projects;
          // Prevent cursor jumps by only updating if data actually differs
          setProjects(prev => JSON.stringify(prev) !== JSON.stringify(cloudProjects) ? cloudProjects : prev);
        }
      }, (error) => {
        console.error("Snapshot error:", error);
      });
      
      return () => unsubscribe();
    }
  }, [user]);

  const handleShareLink = async () => {
    if (!db) {
      alert("Sharing via link requires an active database connection.");
      return;
    }
    if (!user) {
      alert("Still authenticating. Please wait a moment.");
      return;
    }

    try {
      // Push copy of current project state to a public collection
      const sharedColRef = collection(db, 'artifacts', appId, 'public', 'data', 'shared_projects');
      const docRef = await addDoc(sharedColRef, { projects });
      
      const url = `${window.location.origin}${window.location.pathname}?share=${docRef.id}`;
      
      navigator.clipboard.writeText(url).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 3000);
      }).catch(() => {
        prompt("Copy shareable link:", url);
      });
    } catch (err) {
      console.error("Sharing failed", err);
      alert("Failed to generate share link. Check console for details.");
    }
  };

  // --- Graph Interactions ---

  const handleCanvasMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });

    if (draggedNodeId) {
      // Update local state ONLY while dragging (skip Sync to prevent massive API calls)
      updateNodesState(nodes.map(n => 
        n.id === draggedNodeId ? { ...n, x: x - offset.x - NODE_WIDTH/2, y: y - offset.y - 20 } : n
      ), true);
    } else if (isPanning) {
      setOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggedNodeId) {
      // Sync final position to Firebase
      updateNodesState(nodes);
    }
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg') {
      setIsPanning(true);
      setSelectedNodeId(null);
      if (connectingChoiceId) setConnectingChoiceId(null);
    }
  };

  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    if (connectingChoiceId) {
      // Complete connection
      const updatedNodes = nodes.map(n => {
        const updatedChoices = n.choices.map(c => 
          c.id === connectingChoiceId ? { ...c, targetId: nodeId } : c
        );
        return { ...n, choices: updatedChoices };
      });
      updateNodesState(updatedNodes);
      setConnectingChoiceId(null);
    } else {
      setSelectedNodeId(nodeId);
      setDraggedNodeId(nodeId);
    }
  };

  // --- Node CRUD ---

  const addNode = () => {
    let spawnX = -offset.x + 100;
    let spawnY = -offset.y + 100;

    // Spawn next to selected node if there is one
    if (selectedNodeId) {
      const selNode = nodes.find(n => n.id === selectedNodeId);
      if (selNode) {
        spawnX = selNode.x + NODE_WIDTH + 60;
        spawnY = selNode.y;
      }
    }

    const newNode = {
      id: `node-${Date.now()}`,
      title: 'New Node',
      text: 'Write your story here...',
      avScript: '',
      sfx: null,
      x: spawnX,
      y: spawnY,
      color: '#1f2937',
      choices: []
    };
    updateNodesState([...nodes, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const deleteNode = (idToDelete) => {
    const updatedNodes = nodes.filter(n => n.id !== idToDelete).map(n => ({
      ...n,
      choices: n.choices.map(c => c.targetId === idToDelete ? { ...c, targetId: '' } : c)
    }));
    updateNodesState(updatedNodes);
    if (selectedNodeId === idToDelete) setSelectedNodeId(null);
  };

  const updateSelectedNode = (updates) => {
    const updatedNodes = nodes.map(node => 
      node.id === selectedNodeId ? { ...node, ...updates } : node
    );
    updateNodesState(updatedNodes);
  };

  const addChoice = () => {
    const activeNode = nodes.find(n => n.id === selectedNodeId);
    if (!activeNode) return;
    const newChoice = { id: `choice-${Date.now()}`, text: 'New Choice', targetId: '' };
    updateSelectedNode({ choices: [...activeNode.choices, newChoice] });
  };

  const updateChoice = (choiceId, updates) => {
    const activeNode = nodes.find(n => n.id === selectedNodeId);
    if (!activeNode) return;
    const updatedChoices = activeNode.choices.map(c => 
      c.id === choiceId ? { ...c, ...updates } : c
    );
    updateSelectedNode({ choices: updatedChoices });
  };

  const deleteChoice = (choiceId) => {
    const activeNode = nodes.find(n => n.id === selectedNodeId);
    if (!activeNode) return;
    updateSelectedNode({ choices: activeNode.choices.filter(c => c.id !== choiceId) });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Compress image using canvas before storing to keep size manageable
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; // max width for display
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        updateSelectedNode({ image: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSfxUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      updateSelectedNode({ sfx: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  // --- Render Helpers ---
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const playerNode = nodes.find(n => n.id === currentPlayerNodeId);

  const themeClasses = {
    appBg: theme === 'dark' ? 'bg-[#1c1d21] text-zinc-400' : 'bg-slate-50 text-slate-600',
    panelBg: theme === 'dark' ? 'bg-[#24262b]/60 border-zinc-700/50' : 'bg-white/60 border-slate-200',
    cardBg: theme === 'dark' ? 'bg-[#24262b]/80 border-zinc-700/50 text-zinc-400' : 'bg-white/80 border-slate-200 text-slate-600',
    textPrimary: theme === 'dark' ? 'text-zinc-200' : 'text-slate-800',
    textSecondary: theme === 'dark' ? 'text-zinc-400' : 'text-slate-500',
    textMuted: theme === 'dark' ? 'text-zinc-500' : 'text-slate-400',
    btn: theme === 'dark' ? 'bg-zinc-800/40 hover:bg-zinc-700/50 text-zinc-300 border-zinc-700/50' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200',
    input: theme === 'dark' ? 'bg-zinc-900/40 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400',
    hover: theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5',
    choiceItem: theme === 'dark' ? 'bg-zinc-900/30 border-zinc-700/50' : 'bg-slate-50/50 border-slate-200',
    connLine: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    dotColor: theme === 'dark' ? '%23ffffff' : '%23000000',
    iconBtn: theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50',
    shadowInner: theme === 'dark' ? 'shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' : 'shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]'
  };

  const renderConnections = () => {
    const lines = [];
    
    // Helper to calculate how many lines a text block will take up based on approx character width
    const getLinesCount = (str, charsPerLine) => {
      if (!str) return 1;
      return str.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    };

    nodes.forEach(node => {
      // Calculate dynamic height offset for this node
      const headerH = 37;
      const imageH = node.image ? 128 : 0;
      
      const textLines = getLinesCount(node.text || 'Empty text...', 38);
      const textH = (textLines * 16) + 32; // 16px line height + 24px pad + 8px margin
      
      const avLines = node.avScript ? getLinesCount(`[A/V] ${node.avScript}`, 38) : 0;
      const avH = node.avScript ? (avLines * 15) + 8 : 0; // 15px line height + 8px pad

      const baseChoicesY = node.y + offset.y + headerH + imageH + textH + avH;

      node.choices.forEach((choice, idx) => {
        const startX = node.x + offset.x + NODE_WIDTH - 12; // Anchor is ~12px from right edge
        const startY = baseChoicesY + (idx * 24) + 12; // 24px height per choice, centered at +12
        
        let endX, endY;
        
        if (connectingChoiceId === choice.id) {
          endX = mousePos.x;
          endY = mousePos.y;
        } else if (choice.targetId) {
          const target = nodes.find(n => n.id === choice.targetId);
          if (target) {
            endX = target.x + offset.x - 6; // Target left edge anchor offset (-left-1.5 = -6px)
            endY = target.y + offset.y + 46; // Target top-10 (40px) + center of 12px anchor (6px) = 46px
          } else {
            return;
          }
        } else {
          return;
        }

        const cp1x = startX + Math.abs(endX - startX) / 2;
        const cp2x = endX - Math.abs(endX - startX) / 2;

        lines.push(
          <path
            key={`line-${choice.id}`}
            d={`M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`}
            fill="none"
            stroke={connectingChoiceId === choice.id ? "#60a5fa" : themeClasses.connLine}
            strokeWidth="3"
            className={connectingChoiceId === choice.id ? "animate-pulse" : ""}
          />
        );
      });
    });
    return lines;
  };

  return (
    <div className={`flex flex-col h-screen ${themeClasses.appBg} font-sans selection:bg-indigo-500/30 overflow-hidden transition-colors duration-300`}>
      
      {/* Header (Hidden in Print) */}
      <header className={`print:hidden flex items-center justify-between px-6 py-3 ${themeClasses.panelBg} backdrop-blur-xl border-b shadow-sm z-20 transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          {mode === 'editor' && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`mr-1 p-1.5 rounded-lg transition-colors ${themeClasses.iconBtn}`}
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-8 h-8 bg-indigo-500/60 backdrop-blur-md rounded-lg flex items-center justify-center shadow-[inset_0_0_1px_1px_rgba(255,255,255,0.1)] border border-indigo-400/30">
            <Hexagon className="w-5 h-5 text-white" />
          </div>
          <h1 className={`text-lg font-medium tracking-tight ${themeClasses.textPrimary}`}>KWNTO</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-1.5 rounded-lg transition-colors ${themeClasses.iconBtn}`}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {mode === 'editor' && (
            <>
              <button
                onClick={handleShareLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 border shadow-sm rounded-lg text-sm font-medium transition-all duration-150 active:scale-95 ${themeClasses.btn}`}
                title="Copy Link to Share Session"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>

              <button
                onClick={saveToPDF}
                className={`flex items-center gap-1.5 px-3 py-1.5 border shadow-sm rounded-lg text-sm font-medium transition-all duration-150 active:scale-95 ${themeClasses.btn}`}
                title="Export Story to Print / PDF"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </>
          )}

          <button
            onClick={toggleMode}
            className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-95 shadow-sm ${
              mode === 'editor' 
                ? 'bg-indigo-500/60 text-zinc-100 hover:bg-indigo-500/70 border border-indigo-400/40 shadow-[inset_0_0_1px_1px_rgba(255,255,255,0.1)]' 
                : themeClasses.btn
            }`}
          >
            {mode === 'editor' ? (
              <span className="flex items-center gap-1.5"><Play className="w-4 h-4 fill-current" /> Play</span>
            ) : (
              <span className="flex items-center gap-1.5"><Edit className="w-4 h-4" /> Editor</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content (Hidden in Print) */}
      <main className="print:hidden flex-1 overflow-hidden relative flex">
        {shareToast && (
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 ${themeClasses.panelBg} backdrop-blur-xl ${themeClasses.textPrimary} font-medium text-sm px-6 py-2.5 rounded-full shadow-lg border animate-in fade-in slide-in-from-top-2`}>
            Link copied to clipboard
          </div>
        )}
        {mode === 'editor' && (
          <>
            {/* Left Sidebar - Projects & Chapters */}
            {isSidebarOpen && (
              <div className="relative z-20 flex-shrink-0 flex" style={{ width: sidebarWidth }}>
                <div className={`flex-1 ${themeClasses.panelBg} backdrop-blur-xl border-r flex flex-col shadow-lg overflow-y-auto w-full h-full transition-colors duration-300`}>
                  <div className={`p-4 flex justify-between items-center sticky top-0 z-10 ${themeClasses.panelBg} backdrop-blur-md border-b`}>
                    <h2 className={`text-xs font-semibold ${themeClasses.textMuted} uppercase tracking-wider`}>Projects</h2>
                    <button 
                      onClick={handleAddProject}
                      className={`${themeClasses.textMuted} hover:text-indigo-400 transition-colors p-1`}
                      title="New Project"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1 p-2 space-y-1">
                    {projects.map(proj => (
                      <div key={proj.id} className="rounded-xl overflow-hidden">
                        <div 
                          className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors rounded-lg ${activeProjectId === proj.id ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : `${themeClasses.hover} ${themeClasses.textSecondary} border border-transparent`}`}
                          onClick={() => {
                            setActiveProjectId(proj.id);
                            if (proj.subsections.length > 0) setActiveSubId(proj.subsections[0].id);
                          }}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium truncate pr-2">
                            <Folder className={`w-4 h-4 shrink-0 ${activeProjectId === proj.id ? 'text-indigo-400' : 'opacity-60'}`} />
                            <input 
                              type="text"
                              value={proj.title}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => syncProjectsState(projects.map(p => p.id === proj.id ? { ...p, title: e.target.value } : p))}
                              className={`bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-500/50 rounded px-1 w-full min-w-[50px] truncate ${activeProjectId === proj.id ? 'text-indigo-500' : themeClasses.textSecondary}`}
                            />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={(e) => handleAddSubsection(e, proj.id)}
                              className={`p-1 rounded-md transition-colors opacity-60 hover:opacity-100 hover:text-indigo-400`}
                              title="Add Chapter"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteProject(e, proj.id)}
                              className={`p-1 rounded-md transition-colors opacity-60 hover:opacity-100 hover:text-red-400`}
                              title="Delete Project"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        {activeProjectId === proj.id && (
                          <div className={`flex flex-col ml-6 mt-1 space-y-0.5 border-l-2 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'} pl-2`}>
                            {proj.subsections.map(sub => (
                              <div 
                                key={sub.id}
                                onClick={() => setActiveSubId(sub.id)}
                                className={`group flex items-center justify-between px-2 py-1.5 text-sm cursor-pointer transition-colors rounded-md ${
                                  activeSubId === sub.id 
                                    ? 'bg-indigo-500/10 text-indigo-500 font-medium' 
                                    : `${themeClasses.textSecondary} ${themeClasses.hover}`
                                }`}
                              >
                                <div className="flex items-center gap-2 w-full truncate pr-2">
                                  <FileText className="w-3.5 h-3.5 shrink-0 opacity-50" />
                                  <input 
                                    type="text"
                                    value={sub.title}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => syncProjectsState(projects.map(p => p.id === proj.id ? { ...p, subsections: p.subsections.map(s => s.id === sub.id ? { ...s, title: e.target.value } : s) } : p))}
                                    className={`bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-500/50 rounded px-1 w-full min-w-[50px] truncate ${activeSubId === sub.id ? 'text-indigo-500' : themeClasses.textSecondary}`}
                                  />
                                </div>
                                <button 
                                  onClick={(e) => handleDeleteSubsection(e, proj.id, sub.id)}
                                  className="text-red-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                  title="Delete Chapter"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Resizer Handle */}
                <div 
                  className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize ${theme === 'dark' ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-black/5 active:bg-black/10'} transition-colors z-30`}
                  onMouseDown={() => setIsResizingSidebar(true)}
                />
              </div>
            )}

            {/* Canvas Area */}
            <div 
              ref={canvasRef}
              className={`flex-1 relative overflow-hidden bg-transparent ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='${themeClasses.dotColor}' fill-opacity='0.07'/%3E%3C/svg%3E")`,
                backgroundPosition: `${offset.x}px ${offset.y}px`
              }}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onMouseDown={handleCanvasMouseDown}
            >
              {/* SVG Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {renderConnections()}
              </svg>

              {/* Nodes */}
              {nodes.map(node => (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{ 
                    transform: `translate(${node.x + offset.x}px, ${node.y + offset.y}px)`,
                    width: NODE_WIDTH,
                  }}
                  className={`absolute top-0 left-0 rounded-2xl ${themeClasses.cardBg} backdrop-blur-2xl shadow-lg border cursor-move z-10 ${
                    draggedNodeId === node.id ? `scale-[1.02] ring-2 ring-indigo-500/30 border-indigo-400/60 z-50 shadow-xl` : 'transition-all duration-150 ease-out'
                  } ${
                    selectedNodeId === node.id && draggedNodeId !== node.id ? 'ring-1 ring-indigo-500/40 border-indigo-500/40 scale-[1.02]' : (theme === 'dark' ? 'hover:border-zinc-600/60' : 'hover:border-slate-300')
                  } ${connectingChoiceId ? 'hover:ring-1 hover:ring-indigo-400/50 cursor-crosshair' : ''}`}
                >
                  {/* Node Header */}
                  <div 
                    className={`px-4 py-3 rounded-t-2xl flex justify-between items-center pointer-events-none border-b ${theme === 'dark' ? 'border-zinc-700/50' : 'border-slate-200/50'} ${themeClasses.shadowInner}`}
                    style={{ backgroundColor: node.color ? (theme === 'dark' ? `${node.color}99` : `${node.color}E6`) : (theme === 'dark' ? '#1f293799' : '#1f2937E6') }}
                  >
                    <span className="font-medium text-sm text-white flex items-center gap-1.5 truncate drop-shadow-sm">
                      {node.title}
                      {node.sfx && <Volume2 className="w-3.5 h-3.5 text-white/80" />}
                    </span>
                    <button 
                      onMouseDown={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      className="text-white/60 hover:text-white transition-colors pointer-events-auto drop-shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Image Preview (if present) */}
                  {node.image && (
                    <div className={`w-full h-32 ${theme === 'dark' ? 'bg-black/20 border-zinc-700/30' : 'bg-black/5 border-slate-200/50'} border-b flex items-center justify-center p-1`}>
                      <img src={node.image} alt="Node" className="max-w-full max-h-full object-contain pointer-events-none rounded-md opacity-90" />
                    </div>
                  )}

                  {/* Node Preview */}
                  <div className={`p-4 text-[13px] ${themeClasses.textSecondary} mb-2 pointer-events-none font-sans whitespace-pre-wrap break-words leading-relaxed`}>
                    {node.text || <span className="italic opacity-40">Empty text...</span>}
                  </div>

                  {/* A/V Script Preview */}
                  {node.avScript && (
                    <div className={`px-4 pb-2 text-[11px] ${themeClasses.textMuted} pointer-events-none whitespace-pre-wrap break-words leading-[16px]`}>
                      <span className="font-medium text-indigo-400 mr-1 drop-shadow-sm">[A/V]</span>{node.avScript}
                    </div>
                  )}

                  {/* Node Choices Anchors */}
                  <div className="pb-3">
                    {node.choices.map(choice => (
                      <div key={choice.id} className="flex justify-end items-center px-3 h-6 relative pointer-events-none">
                        <div className={`text-[11px] ${themeClasses.textSecondary} font-medium truncate mr-2 ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-white/80 border-slate-200/80'} px-2.5 py-0.5 rounded-full border shadow-sm backdrop-blur-md`}>
                          {choice.text || 'Untitled'}
                        </div>
                        {/* Output Anchor Point */}
                        <div 
                          className={`w-3.5 h-3.5 rounded-full border-[2.5px] shadow-sm ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'} ${
                            connectingChoiceId === choice.id 
                              ? 'border-indigo-400 animate-pulse scale-125' 
                              : choice.targetId 
                                ? (theme === 'dark' ? 'border-zinc-500' : 'border-slate-400')
                                : (theme === 'dark' ? 'border-zinc-700' : 'border-slate-300')
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Input Anchor (Visual only) */}
                  <div className={`absolute top-10 -left-[7px] w-3.5 h-3.5 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-300'} border-[2.5px] rounded-full shadow-sm pointer-events-none`} />
                </div>
              ))}
              
              {connectingChoiceId && (
                <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 ${themeClasses.panelBg} backdrop-blur-xl border ${themeClasses.textPrimary} px-5 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-none z-50`}>
                  <ArrowRight className="w-4 h-4 text-indigo-400" /> Select a target node
                </div>
              )}
            </div>

            {/* Properties Panel (Right Sidebar) */}
            <div className={`w-80 ${themeClasses.panelBg} backdrop-blur-xl border-l flex flex-col shadow-lg z-20 transition-colors duration-300`}>
              <div className={`p-4 border-b flex justify-between items-center sticky top-0 ${themeClasses.panelBg} backdrop-blur-md`}>
                <h2 className={`text-xs font-semibold ${themeClasses.textMuted} uppercase tracking-wider`}>Properties</h2>
                <button 
                  onClick={addNode}
                  className={`flex items-center gap-1 text-xs font-medium border shadow-sm px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95 ${themeClasses.btn}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Node
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {selectedNode ? (
                  <>
                    <div className="space-y-2">
                      <label className={`block text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>Script</label>
                      <textarea
                        value={selectedNode.text}
                        onChange={(e) => updateSelectedNode({ text: e.target.value })}
                        className={`w-full h-32 rounded-xl p-3 text-sm border focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none resize-none transition-all shadow-sm ${themeClasses.input}`}
                        placeholder="Write your story here..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={`block text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>A/V Notes</label>
                      <textarea
                        value={selectedNode.avScript || ''}
                        onChange={(e) => updateSelectedNode({ avScript: e.target.value })}
                        placeholder="Audio or visual cues..."
                        className={`w-full h-20 rounded-xl p-3 text-xs border focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none resize-none transition-all shadow-sm ${themeClasses.input}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Image Upload */}
                      <div className="space-y-2">
                        <label className={`block text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>Image</label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          ref={fileInputRef}
                          onChange={handleImageUpload} 
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className={`w-full flex items-center justify-center gap-2 py-2 border shadow-sm rounded-lg transition-colors text-xs font-medium ${themeClasses.btn}`}
                        >
                          <ImageIcon className="w-4 h-4" /> {selectedNode.image ? 'Change' : 'Upload'}
                        </button>
                        {selectedNode.image && (
                          <button 
                            onClick={() => updateSelectedNode({ image: null })}
                            className="w-full text-xs font-medium text-red-400 hover:text-red-500 mt-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* SFX Upload */}
                      <div className="space-y-2">
                        <label className={`block text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>SFX</label>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          ref={audioInputRef}
                          onChange={handleSfxUpload}
                        />
                        <button
                          onClick={() => audioInputRef.current?.click()}
                          className={`w-full flex items-center justify-center gap-2 py-2 border shadow-sm rounded-lg transition-colors text-xs font-medium ${themeClasses.btn}`}
                        >
                          <Volume2 className="w-4 h-4" /> {selectedNode.sfx ? 'Change' : 'Upload'}
                        </button>
                        {selectedNode.sfx && (
                          <button
                            onClick={() => updateSelectedNode({ sfx: null })}
                            className="w-full text-xs font-medium text-red-400 hover:text-red-500 mt-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <label className={`block text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>Label Color</label>
                      <div className="flex flex-wrap gap-2.5">
                        {COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => updateSelectedNode({ color })}
                              className={`w-7 h-7 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] border-2 transition-transform hover:scale-110 ${selectedNode.color === color ? (theme === 'dark' ? 'border-zinc-300 scale-110 ring-2 ring-zinc-500/20' : 'border-slate-800 scale-110 ring-2 ring-slate-500/20') : 'border-transparent'}`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>

                    <div className={`space-y-3 pt-6 border-t ${theme === 'dark' ? 'border-zinc-700/50' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <label className={`block text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>Choices</label>
                        <button 
                          onClick={addChoice}
                          className="text-indigo-500 hover:text-indigo-600 text-xs font-medium flex items-center bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add
                        </button>
                      </div>

                      <div className="space-y-3">
                        {selectedNode.choices.map((choice) => (
                          <div key={choice.id} className={`${themeClasses.choiceItem} border rounded-xl p-3 flex flex-col gap-3`}>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={choice.text}
                                onChange={(e) => updateChoice(choice.id, { text: e.target.value })}
                                placeholder="Choice text..."
                                className={`flex-1 border rounded-md px-2 py-1 text-sm font-medium outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 ${themeClasses.input}`}
                              />
                              <button
                                onClick={() => deleteChoice(choice.id)}
                                className={`${themeClasses.textMuted} hover:text-red-400 p-1.5 rounded-md ${themeClasses.hover} transition-colors border border-transparent`}
                                title="Delete Choice"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className={`flex items-center justify-between ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-700/40' : 'bg-white border-slate-200/50'} border rounded-lg p-2 shadow-sm`}>
                              <span className={`text-xs font-medium ${themeClasses.textMuted} flex items-center gap-1`}>
                                {choice.targetId ? <span className="flex items-center gap-1.5 text-emerald-500"><ArrowRight className="w-3.5 h-3.5"/> Linked</span> : <span className={`flex items-center gap-1.5 ${themeClasses.textMuted}`}><AlertCircle className="w-3.5 h-3.5"/> Empty</span>}
                              </span>
                              <div className="flex gap-1.5">
                                {choice.targetId && (
                                  <button
                                    onClick={() => updateChoice(choice.id, { targetId: '' })}
                                    className={`text-xs font-medium ${themeClasses.textMuted} hover:text-red-400 flex items-center gap-1 ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-slate-100'} hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors`}
                                    title="Unlink"
                                  >
                                    <Unlink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setConnectingChoiceId(connectingChoiceId === choice.id ? null : choice.id)}
                                  className={`text-xs font-medium px-3 py-1 rounded-md transition-colors border ${
                                    connectingChoiceId === choice.id 
                                      ? 'bg-indigo-500/60 text-white border-indigo-400/50' 
                                      : `${theme === 'dark' ? 'bg-zinc-800/50 hover:bg-zinc-700/50 border-zinc-700/50' : 'bg-white hover:bg-slate-50 border-slate-200'} text-indigo-500`
                                  }`}
                                >
                                  {connectingChoiceId === choice.id ? 'Cancel' : 'Link'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedNode.choices.length === 0 && (
                          <div className={`text-center p-4 text-xs font-medium ${themeClasses.textMuted} border border-dashed ${theme === 'dark' ? 'border-zinc-700/50 bg-zinc-800/20' : 'border-slate-300 bg-slate-50/50'} rounded-xl`}>
                            Terminal Node (No choices).
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`h-full flex flex-col items-center justify-center ${themeClasses.textMuted} gap-4 text-center`}>
                    <Hexagon className="w-12 h-12 opacity-50" />
                    <p className="text-sm font-medium">Select a node<br/>to edit properties.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Player Mode */}
        {mode === 'player' && (
          <div className="w-full h-full overflow-y-auto bg-transparent flex flex-col items-center p-6 sm:p-12 relative"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='${themeClasses.dotColor}' fill-opacity='0.07'/%3E%3C/svg%3E")`
               }}
          >
            
            {deadEndMessage && (
              <div className="absolute top-6 z-50 bg-red-500/10 backdrop-blur-xl text-red-500 border border-red-500/20 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4 font-medium text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>{deadEndMessage}</span>
              </div>
            )}

            {!playerNode ? (
              <div className={`${themeClasses.cardBg} backdrop-blur-2xl p-10 rounded-3xl max-w-md text-center border shadow-xl mt-20 animate-in fade-in zoom-in-95 duration-200 ease-out`}>
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h2 className={`text-xl font-medium ${themeClasses.textPrimary} mb-2`}>Story Error</h2>
                <p className={`${themeClasses.textSecondary} mb-8`}>No valid starting node found to begin the story.</p>
                <button 
                  onClick={toggleMode}
                  className={`px-6 py-2.5 font-medium text-sm rounded-lg transition-all duration-150 active:scale-95 border ${themeClasses.btn}`}
                >
                  Return to Editor
                </button>
              </div>
            ) : (
              <div key={playerNode.id} className="w-full max-w-2xl mt-4 sm:mt-8 animate-in fade-in slide-in-from-bottom-4 zoom-in-[0.98] duration-200 ease-out">
                <div className={`${themeClasses.cardBg} backdrop-blur-2xl rounded-3xl shadow-xl border overflow-hidden`}>
                  
                  {playerNode.image && (
                    <div className={`w-full h-64 border-b ${theme === 'dark' ? 'border-zinc-700/50 bg-black/20' : 'border-slate-200/50 bg-black/5'}`}>
                      <img src={playerNode.image} alt={playerNode.title} className="w-full h-full object-contain opacity-90" />
                    </div>
                  )}

                  <div className="p-8 md:p-12">
                    {playerNode.sfx && (
                      <audio
                        src={playerNode.sfx}
                        autoPlay
                        controls
                        className="w-full h-10 mb-8 rounded-lg opacity-60 hover:opacity-90 transition-opacity saturate-50"
                      />
                    )}
                    
                    <h2 className={`text-2xl sm:text-3xl font-semibold tracking-tight ${themeClasses.textPrimary} mb-6 drop-shadow-sm`}>
                      {playerNode.title}
                    </h2>
                    
                    {playerNode.avScript && (
                      <div className="mb-8 p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/10 text-indigo-500 text-sm leading-relaxed whitespace-pre-wrap backdrop-blur-md">
                        <span className="font-medium text-indigo-500 block mb-1">A/V Script</span>
                        {playerNode.avScript}
                      </div>
                    )}

                    <p className={`text-lg ${themeClasses.textSecondary} leading-relaxed mb-12 whitespace-pre-wrap font-normal`}>
                      {playerNode.text}
                    </p>

                    <div className={`space-y-3 mt-8 pt-8 border-t ${theme === 'dark' ? 'border-zinc-700/50' : 'border-slate-200'}`}>
                      {playerNode.choices.length > 0 ? (
                        playerNode.choices.map(choice => {
                          const targetExists = nodes.some(n => n.id === choice.targetId);
                          return (
                            <button
                              key={choice.id}
                              onClick={() => {
                                if (targetExists) {
                                  setDeadEndMessage(null);
                                  setCurrentPlayerNodeId(choice.targetId);
                                } else {
                                  setDeadEndMessage("Dead end detected. Link missing.");
                                  setTimeout(() => setDeadEndMessage(null), 3000);
                                }
                              }}
                              className={`w-full flex items-center justify-between p-5 border text-left rounded-2xl group transition-all duration-150 ease-out active:scale-[0.98] backdrop-blur-sm ${theme === 'dark' ? 'bg-zinc-800/30 border-zinc-700/40 hover:border-zinc-600/50 hover:bg-zinc-700/40' : 'bg-white/50 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                              <span className={`font-medium text-[15px] ${themeClasses.textPrimary} drop-shadow-sm`}>{choice.text}</span>
                              <ChevronRight className={`w-5 h-5 ${themeClasses.textMuted} group-hover:${themeClasses.textPrimary} transform group-hover:translate-x-1 transition-all duration-150`} />
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center text-center space-y-6 pt-4">
                          <h3 className={`text-sm font-medium tracking-widest ${themeClasses.textMuted} uppercase`}>The End</h3>
                          <button
                            onClick={() => setCurrentPlayerNodeId(nodes[0]?.id)}
                            className="px-6 py-2.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-medium text-sm rounded-full hover:bg-indigo-500/20 transition-all duration-150 active:scale-95 backdrop-blur-md"
                          >
                            Restart Sequence
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}