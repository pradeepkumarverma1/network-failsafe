import { useEffect, useState, useCallback } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { GripVertical, X, Power, Wifi, ShieldCheck, Minus, X as CloseIcon } from "lucide-react";

/** Window Controls Component **/
const WindowControls = () => (
  <div className="flex items-center justify-between px-4 py-2 select-none z-50" style={{ WebkitAppRegion: 'drag' }}>
    <div className="flex items-center gap-2 text-zinc-400 font-medium text-sm">
      <ShieldCheck className="w-4 h-4 text-cyan-400" />
      <span>Network FailSafe</span>
    </div>
    <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
      <button onClick={() => window.api.minimize()} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
        <Minus className="w-4 h-4 text-zinc-400" />
      </button>
      <button onClick={() => window.api.hide()} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors">
        <CloseIcon className="w-4 h-4 text-zinc-400 hover:text-white" />
      </button>
    </div>
  </div>
);

/** Sortable Item Component **/
function SortableItem({ id, index, onRemove, isActive }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 border border-white/10 rounded-xl p-3 backdrop-blur-md transition-all duration-300
        ${isDragging ? "bg-white/20 shadow-2xl scale-105" : "bg-white/5 hover:bg-white/10 hover:border-white/20"}
        ${isActive ? "ring-1 ring-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(6,182,212,0.1)]" : ""}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
        <GripVertical className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300" />
      </div>
      <div className="flex-1">
        <div className="text-xs text-zinc-500 font-mono">0{index + 1}</div>
        <div className="text-sm font-semibold text-zinc-200">{id}</div>
      </div>
      {isActive && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full animate-pulse font-bold tracking-tighter">ACTIVE</span>}
      <Button
        size="icon" variant="ghost"
        className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
        onClick={() => onRemove(index)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [priority, setPriority] = useState([]);
  const [status, setStatus] = useState({ online: false, network: null });
  const [autostart, setAutostart] = useState(false);
  const [logs, setLogs] = useState([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // RE-IMPLEMENTED DATA FETCHING
  useEffect(() => {
    let intervalId;
    let isMounted = true;

    const loadData = async () => {
      try {
        // Wait for API to be available
        if (!window.api) return;

        if (window.api && window.api.onLog) {
          window.api.onLog((data) => {
            setLogs((prev) => [data, ...prev].slice(0, 50)); // Keep only latest 50 logs
          });
        }

        const [p, cfg, a] = await Promise.all([
          window.api.getProfiles(),
          window.api.getConfig(),
          window.api.autostartStatus()
        ]);

        if (isMounted) {
          setProfiles(p || []);
          setPriority(cfg?.priorityList || []);
          setAutostart(!!a);
        }

        // Start polling for status
        intervalId = setInterval(async () => {
          const s = await window.api.getStatus();
          if (isMounted && s) setStatus(s);
        }, 2000);

      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };

    loadData();

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const saveAndApply = async () => {
    try {
      await window.api.saveConfig({ priorityList: priority });
      // We call restart so the engine re-reads the file we just saved
      await window.api.restartEngine();
      alert("Rules Deployed Successfully!");
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPriority((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="h-screen w-screen bg-[#050505] text-zinc-200 font-sans border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">

      {/* Performance Boost: Removed dynamic background blur circles */}

      <div className="relative z-10 flex flex-col h-full">
        <WindowControls />

        {/* Main Scrollable Area - This is now the ONLY scroll container */}
        <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar fast-scroll">
          <header className="flex justify-between items-end mb-10">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white">
                Network Control
              </h1>
              <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest font-bold">
                Status: <span className="text-zinc-300">{status.state || 'IDLE'}</span>
              </p>
            </div>

            {/* Status Indicator: Solid background for better FPS */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${status.online ? "bg-[#062016] border-emerald-500/30 text-emerald-400" : "bg-[#200606] border-red-500/30 text-red-400"}`}>
              <div className={`w-2 h-2 rounded-full ${status.online ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{status.online ? "Online" : "Offline"}</span>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Sidebar Settings */}
            <div className="md:col-span-4 space-y-6">

              {/* Solid Card: Autostart */}
              <div className="p-5 bg-[#111111] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400"><Power size={18} /></div>
                    <span className="text-sm font-bold">Autostart</span>
                  </div>
                  <Switch checked={autostart} onCheckedChange={(val) => {
                    setAutostart(val);
                    val ? window.api.autostartEnable() : window.api.autostartDisable();
                  }} />
                </div>
              </div>

              {/* Solid Card: Visible Signals */}
              <div className="p-6 bg-[#111111] border border-white/5 rounded-2xl">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Visible Signals</h3>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {profiles.length > 0 ? profiles.map(p => (
                    <button
                      key={p}
                      disabled={priority.includes(p)}
                      onClick={() => setPriority(prev => [...prev, p])}
                      className="flex items-center justify-between w-full p-3 rounded-lg border border-white/5 bg-white/[0.03] hover:bg-white/10 disabled:opacity-20 transition-all group"
                    >
                      <span className="text-xs font-medium truncate pr-2">{p}</span>
                      <Wifi size={12} className="text-zinc-600 group-hover:text-cyan-400" />
                    </button>
                  )) : (
                    <div className="text-[10px] text-zinc-700 text-center py-4 italic">Scanning airwaves...</div>
                  )}
                </div>
              </div>

              {/* Solid Card: Engine console (NO BLUR) */}
              <div className="p-5 bg-black border border-white/5 rounded-2xl h-64 flex flex-col shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Engine Console</h3>
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                </div>

                <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1.5 pr-2 custom-scrollbar">
                  {logs.length > 0 ? logs.map((log, i) => (
                    <div key={i} className="leading-relaxed border-l border-white/5 pl-2">
                      <span className="text-zinc-600 mr-2">{log.timestamp}</span>
                      <span className={log.message.toLowerCase().includes('failed') || log.message.toLowerCase().includes('lost') ? 'text-red-500' : 'text-zinc-400'}>
                        {log.message}
                      </span>
                    </div>
                  )) : (
                    <div className="text-zinc-800 italic">Standby...</div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Priority List */}
            <div className="md:col-span-8">
              <div className="bg-[#111111] border border-white/5 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-8">
                  <h2 className="text-xs font-black text-zinc-400 mb-8 flex items-center gap-2 uppercase tracking-[0.15em]">
                    Priority Sequence
                    <span className="text-[9px] font-normal text-zinc-600 bg-black/40 px-2 py-0.5 rounded-md border border-white/5 lowercase italic tracking-normal">drag to reorder</span>
                  </h2>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={priority} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3 min-h-[120px]">
                        {priority.map((p, i) => (
                          <SortableItem key={p} id={p} index={i} onRemove={(idx) => setPriority(prev => prev.filter((_, i) => i !== idx))} isActive={status.network === p} />
                        ))}
                        {priority.length === 0 && (
                          <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl text-zinc-700 space-y-2">
                            <Wifi size={32} strokeWidth={1} />
                            <p className="text-[10px] font-bold uppercase">No networks in sequence</p>
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <button
                    className="mt-10 w-full py-5 rounded-xl bg-white text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all duration-200 active:scale-[0.98] disabled:opacity-10"
                    onClick={saveAndApply}
                    disabled={priority.length === 0}
                  >
                    Apply Engine Logic
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Solid Footer */}
        <footer className="px-8 py-4 bg-[#050505] border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4 opacity-40">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black">Build v1.0.4-Lite</span>
            <div className="h-3 w-px bg-white/20" />
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-black">Performance Mode</span>
          </div>

          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            Created by <span className="text-white px-2 py-1 bg-white/5 rounded border border-white/10 ml-1">Pradeep Kumar Verma</span>
          </div>
        </footer>

      </div>
    </div>
  );
}