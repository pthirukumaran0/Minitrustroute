'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ProviderNode, ProviderEdge } from '@/src/types/frontend';
import {
  ShieldCheck,
  ArrowRight,
  Zap,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Move,
  Maximize2,
} from 'lucide-react';

interface RouteGraphVisualizerProps {
  nodes: ProviderNode[];
  edges: ProviderEdge[];
  selectedHops?: string[];
  alternativeHops?: string[][];
  highlightRouteName?: string;
  className?: string;
  onSelectNode?: (nodeId: string) => void;
  onSelectEdge?: (edge: ProviderEdge) => void;
  selectedNodeId?: string | null;
  selectedEdge?: { source: string; target: string } | null;
  noRouteMessage?: string;
}

export function RouteGraphVisualizer({
  nodes,
  edges,
  selectedHops = [],
  alternativeHops = [],
  highlightRouteName,
  className = '',
  onSelectNode,
  onSelectEdge,
  selectedNodeId,
  selectedEdge,
  noRouteMessage,
}: RouteGraphVisualizerProps) {
  const [hoveredNode, setHoveredNode] = useState<ProviderNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<ProviderEdge | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(2.2, prev + 0.2));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.6, prev - 0.2));
  const handleResetZoomPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on canvas background, not when clicking on nodes
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).tagName === 'rect') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Deterministic 2D coordinates for known nodes (with fallback layout for dynamic ones)
  const layoutCoordinates: Record<string, { x: number; y: number }> = {
    // Column 1: Gateways (x: 70)
    'Gateway-US': { x: 70, y: 90 },
    'Gateway-EU': { x: 70, y: 210 },
    'Gateway-Asia': { x: 70, y: 330 },

    // Column 2: Clearing Banks (x: 250)
    'Bank-JPMorgan': { x: 250, y: 80 },
    'Bank-Deutsche': { x: 250, y: 200 },
    'Bank-DBS-Singapore': { x: 250, y: 320 },

    // Column 3: Global Clearing & Corridors (x: 460)
    'Swift-Direct': { x: 460, y: 70 },
    'Corridor-MiddleEast': { x: 460, y: 170 },
    'Corridor-SEPA-Instant': { x: 460, y: 270 },
    'Clearing-India-NEFT': { x: 460, y: 370 },

    // Column 4: Settlement / Destination Banks (x: 680)
    'Bank-Barclays-London': { x: 680, y: 60 },
    'Bank-Dubai-Commercial': { x: 680, y: 140 },
    'Bank-SBI-Mumbai': { x: 680, y: 220 },
    'Bank-HDFC-Delhi': { x: 680, y: 300 },
    'Bank-Isolated-Pacific': { x: 680, y: 380 },
  };

  const getNodePos = (node: ProviderNode, index: number) => {
    if (layoutCoordinates[node.id]) {
      return layoutCoordinates[node.id];
    }
    // Fallback circular layout for any extra nodes
    const col = node.type === 'GATEWAY' ? 80 : node.type === 'DESTINATION_BANK' ? 660 : 360;
    const row = 60 + (index % 6) * 55;
    return { x: col, y: row };
  };

  // Helper to check if an edge is in the selected route
  const isEdgeInRoute = (src: string, tgt: string) => {
    if (selectedHops.length < 2) return false;
    for (let i = 0; i < selectedHops.length - 1; i++) {
      if (selectedHops[i] === src && selectedHops[i + 1] === tgt) {
        return true;
      }
    }
    return false;
  };

  // Helper to check if an edge is in any alternative route
  const isEdgeInAlternative = (src: string, tgt: string) => {
    if (alternativeHops.length === 0) return false;
    for (const alt of alternativeHops) {
      if (alt.length < 2) continue;
      for (let i = 0; i < alt.length - 1; i++) {
        if (alt[i] === src && alt[i + 1] === tgt) {
          return true;
        }
      }
    }
    return false;
  };

  const isNodeInRoute = (id: string) => selectedHops.includes(id);
  const isNodeInAlternative = (id: string) => alternativeHops.some((alt) => alt.includes(id));

  return (
    <div className={`relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden ${className}`}>
      {/* Top Banner / Route Title */}
      <div className="absolute top-3 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-700/60 pointer-events-auto">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-200">
            {highlightRouteName || (selectedHops.length > 0 ? `Active Path: ${selectedHops.join(' ➔ ')}` : 'Live Neo4j Payment Topology')}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400 bg-slate-800/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-700/60 pointer-events-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Selected Path
          </span>
          {alternativeHops.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
              Alternatives
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            Active Rail
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            Prohibited
          </span>
        </div>
      </div>

      {/* Floating Zoom and Pan Controls */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-slate-800/90 backdrop-blur-xs p-1 rounded-lg border border-slate-700/70 shadow-lg text-slate-300">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetZoomPan}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetZoomPan}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-mono px-2"
          title="Reset Zoom & Pan"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{Math.round(zoom * 100)}%</span>
        </button>
      </div>

      {/* Alert Banner when No Valid Route Available */}
      {noRouteMessage && (
        <div className="absolute top-14 left-4 z-20 flex items-center gap-2 bg-rose-950/90 border border-rose-800 text-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-xs shadow-md">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{noRouteMessage}</span>
        </div>
      )}

      {/* SVG Interactive Canvas */}
      <svg
        ref={svgRef}
        viewBox="0 0 780 440"
        className={`w-full h-auto select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Arrow marker for standard rail */}
          <marker id="arrow-active" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3B82F6" />
          </marker>
          {/* Arrow marker for highlighted route */}
          <marker id="arrow-highlight" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#10B981" />
          </marker>
          {/* Arrow marker for alternative route */}
          <marker id="arrow-alternative" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38BDF8" />
          </marker>
          {/* Arrow marker for prohibited rail */}
          <marker id="arrow-prohibited" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EF4444" />
          </marker>
          {/* Subtle node glow */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Pan and Zoom Container */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Background capture for drag panning */}
          <rect x="-1000" y="-1000" width="3000" height="3000" fill="transparent" />

          {/* 1. Render Connections (Edges) */}
          {edges.map((edge) => {
            const srcNode = nodes.find((n) => n.id === edge.source);
            const tgtNode = nodes.find((n) => n.id === edge.target);
            if (!srcNode || !tgtNode) return null;

            const srcPos = getNodePos(srcNode, 0);
            const tgtPos = getNodePos(tgtNode, 0);

            const inRoute = isEdgeInRoute(edge.source, edge.target);
            const inAlternative = isEdgeInAlternative(edge.source, edge.target);
            const isProhibited = edge.prohibited || !edge.isAvailable || edge.status !== 'ACTIVE';
            const isSelectedEdge = Boolean(
              selectedEdge && selectedEdge.source === edge.source && selectedEdge.target === edge.target
            );

            let strokeColor = '#334155'; // default slate-700
            let strokeWidth = 2;
            let markerEnd = 'url(#arrow-active)';
            let strokeDash = undefined;

            if (isSelectedEdge) {
              strokeColor = '#F59E0B'; // amber
              strokeWidth = 4;
              markerEnd = 'url(#arrow-highlight)';
            } else if (inRoute) {
              strokeColor = '#10B981'; // vibrant emerald
              strokeWidth = 3.5;
              markerEnd = 'url(#arrow-highlight)';
            } else if (inAlternative) {
              strokeColor = '#38BDF8'; // sky blue
              strokeWidth = 2.5;
              strokeDash = '6,3';
              markerEnd = 'url(#arrow-alternative)';
            } else if (isProhibited) {
              strokeColor = '#EF4444'; // rose
              strokeWidth = 1.5;
              strokeDash = '4,4';
              markerEnd = 'url(#arrow-prohibited)';
            } else {
              strokeColor = '#3B82F6';
              strokeWidth = 1.8;
            }

            // Compute midpoint for cost/latency badge
            const midX = (srcPos.x + tgtPos.x) / 2;
            const midY = (srcPos.y + tgtPos.y) / 2 - 6;

            return (
              <g
                key={`${edge.source}-${edge.target}`}
                className="cursor-pointer group"
                onClick={() => onSelectEdge && onSelectEdge(edge)}
                onMouseEnter={() => setHoveredEdge(edge)}
                onMouseLeave={() => setHoveredEdge(null)}
              >
                {/* Invisible thicker path for easier hovering */}
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke="transparent"
                  strokeWidth={16}
                />
                {/* Visible edge line */}
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDash}
                  markerEnd={markerEnd}
                  className="transition-all duration-200"
                />
                {/* Cost badge at midpoint */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-22"
                    y="-9"
                    width="44"
                    height="16"
                    rx="4"
                    fill="#0F172A"
                    stroke={inRoute ? '#10B981' : isProhibited ? '#EF4444' : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill={inRoute ? '#A7F3D0' : isProhibited ? '#FCA5A5' : '#94A3B8'}
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    ${edge.baseCost.toFixed(1)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 2. Render Provider Nodes */}
          {nodes.map((node, i) => {
            const pos = getNodePos(node, i);
            const inRoute = isNodeInRoute(node.id);
            const inAlternative = isNodeInAlternative(node.id);
            const isOrigin = selectedHops.length > 0 && selectedHops[0] === node.id;
            const isDestination = selectedHops.length > 0 && selectedHops[selectedHops.length - 1] === node.id;
            const isSelectedNode = selectedNodeId === node.id;

            let circleFill = '#1E293B';
            let circleStroke = '#475569';
            let radius = 16;

            if (isSelectedNode) {
              circleFill = '#78350F';
              circleStroke = '#F59E0B';
              radius = 20;
            } else if (isOrigin) {
              circleFill = '#065F46';
              circleStroke = '#10B981';
              radius = 20;
            } else if (isDestination) {
              circleFill = '#047857';
              circleStroke = '#34D399';
              radius = 20;
            } else if (inRoute) {
              circleFill = '#064E3B';
              circleStroke = '#10B981';
              radius = 17;
            } else if (inAlternative) {
              circleFill = '#0C4A6E';
              circleStroke = '#38BDF8';
              radius = 16;
            } else if (node.type === 'GATEWAY') {
              circleFill = '#1E3A8A';
              circleStroke = '#3B82F6';
            } else if (node.type === 'DESTINATION_BANK') {
              circleFill = '#312E81';
              circleStroke = '#818CF8';
            }

            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                onClick={() => onSelectNode && onSelectNode(node.id)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                transform={`translate(${pos.x}, ${pos.y})`}
              >
                {/* Outer halo if origin/destination/inRoute/selected */}
                {(isOrigin || isDestination || inRoute || isSelectedNode) && (
                  <circle
                    r={radius + (isSelectedNode ? 6 : isOrigin || isDestination ? 8 : 5)}
                    fill="none"
                    stroke={isSelectedNode ? '#F59E0B' : isOrigin ? '#10B981' : isDestination ? '#34D399' : '#10B981'}
                    strokeWidth={isSelectedNode ? 2.5 : isOrigin || isDestination ? 2.5 : 2}
                    opacity="0.8"
                    className="animate-pulse"
                  />
                )}
                {/* Main Node Circle */}
                <circle
                  r={radius}
                  fill={circleFill}
                  stroke={circleStroke}
                  strokeWidth={inRoute ? 2.5 : 1.5}
                  filter={inRoute ? 'url(#glow)' : undefined}
                  className="transition-all duration-200 group-hover:scale-110"
                />
                {/* Node Icon / Country Code */}
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  pointerEvents="none"
                >
                  {node.country || node.id.slice(0, 3)}
                </text>
                {/* Node Label Below */}
                <text
                  x="0"
                  y={radius + 13}
                  textAnchor="middle"
                  fill={isOrigin || isDestination ? '#34D399' : inRoute ? '#A7F3D0' : '#E2E8F0'}
                  fontSize="9.5"
                  fontWeight={isOrigin || isDestination || inRoute ? 'bold' : '500'}
                  className="pointer-events-none drop-shadow-xs"
                >
                  {node.name.length > 20 ? node.name.slice(0, 18) + '...' : node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Hover Details Box */}
      {hoveredNode && (
        <div className="absolute bottom-3 left-3 bg-slate-800/95 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs text-slate-200 z-20 max-w-xs backdrop-blur-xs">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {hoveredNode.name}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-300">
            <span>ID: <strong className="font-mono text-slate-100">{hoveredNode.id}</strong></span>
            <span>Type: <strong>{hoveredNode.type}</strong></span>
            <span>Country: <strong>{hoveredNode.country}</strong></span>
            <span>Currency: <strong>{hoveredNode.currency}</strong></span>
            <span>Status: <strong className="text-emerald-400">{hoveredNode.status}</strong></span>
          </div>
        </div>
      )}

      {hoveredEdge && (
        <div className="absolute bottom-3 right-28 bg-slate-800/95 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs text-slate-200 z-20 max-w-xs backdrop-blur-xs">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hoveredEdge.prohibited ? 'bg-rose-400' : 'bg-blue-400'}`} />
            {hoveredEdge.source} ➔ {hoveredEdge.target}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-300">
            <span>Base Fee: <strong className="text-white">${hoveredEdge.baseCost.toFixed(2)}</strong></span>
            <span>Latency: <strong>{hoveredEdge.latencyMs} ms</strong></span>
            <span>Reliability: <strong>{(hoveredEdge.reliability * 100).toFixed(1)}%</strong></span>
            <span>State: <strong className={hoveredEdge.prohibited ? 'text-rose-400' : 'text-emerald-400'}>
              {hoveredEdge.prohibited ? 'PROHIBITED' : 'ACTIVE'}
            </strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
