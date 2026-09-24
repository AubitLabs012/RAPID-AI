import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Database,
  FileText,
  LayoutDashboard,
  Radar,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { fetchPredictionAgents, runPredictionAgent } from "../../api";
import { useDashboardStore } from "../../store";
import type { PredictionAgent, PredictionAgentId } from "../../types";
import { Button } from "../ui/button";

type AgentMessage = {
  id: string;
  agentId: PredictionAgentId | "maris" | "sources" | "outputs" | "user";
  author: string;
  role: string;
  content: string;
  status: "queued" | "working" | "done" | "error";
};

const fallbackAgents: PredictionAgent[] = [
  {
    id: "marine",
    letter: "🌊",
    name: "Marine Agent",
    focus: "Ocean monitoring",
    goal: "Understand current marine and environmental conditions.",
    tools: "Python, xarray, live ocean APIs",
    formula: "Mean, SD, Z-score, % change",
  },
  {
    id: "analytics",
    letter: "📊",
    name: "Analytics Agent",
    focus: "Data analysis",
    goal: "Analyze biodiversity and ocean-health patterns.",
    tools: "Pandas, SQL, statistics",
    formula: "Pearson r, Shannon, Simpson",
  },
  {
    id: "reasoning",
    letter: "🧠",
    name: "Reasoning Agent",
    focus: "Scientific reasoning",
    goal: "Connect evidence and explain why something may be happening.",
    tools: "LLM plus RAPID-AI data",
    formula: "Bayes' theorem",
  },
  {
    id: "intelligence",
    letter: "🔮",
    name: "Intelligence Agent",
    focus: "Prediction",
    goal: "Forecast trends, detect anomalies, and estimate risks.",
    tools: "ML, XGBoost, Scikit-learn",
    formula: "Regression, moving avg, RMSE/MAE",
  },
  {
    id: "synthesis",
    letter: "🧩",
    name: "Synthesis Agent",
    focus: "Final intelligence",
    goal: "Combine everything into a useful answer, report, or alert.",
    tools: "LLM plus report templates",
    formula: "Weighted score / average",
  },
];

const workflowOrder: PredictionAgentId[] = ["marine", "analytics", "reasoning", "intelligence", "synthesis"];

const agentIcons: Record<PredictionAgentId, typeof Activity> = {
  marine: Activity,
  analytics: BarChart3,
  intelligence: Radar,
  reasoning: Brain,
  synthesis: FileText,
};

const agentMapTargets: Record<PredictionAgentId, { label: string; lat: number; lng: number; zoom: number; metric: string }> = {
  marine: { label: "Arabian Sea marine monitoring", lat: 16.5, lng: 67.5, zoom: 5, metric: "health" },
  analytics: { label: "Bay of Bengal analytics zone", lat: 15.0, lng: 88.5, zoom: 5, metric: "biodiversity" },
  intelligence: { label: "Lakshadweep prediction zone", lat: 10.6, lng: 72.6, zoom: 6, metric: "health" },
  reasoning: { label: "Northern Bay of Bengal evidence zone", lat: 18.67, lng: 88.72, zoom: 6, metric: "health" },
  synthesis: { label: "RAPID-AI Indian Ocean synthesis view", lat: 13.0, lng: 78.0, zoom: 4, metric: "health" },
};

let autoStartedPredictionsRoom = false;
const maxAgentOutputChars = 240;

export function PredictionAgentsPanel() {
  const uploadedMarkers = useDashboardStore((state) => state.uploadedMarkers);
  const uploadAnalysis = useDashboardStore((state) => state.uploadAnalysis);
  const setMapFocus = useDashboardStore((state) => state.setMapFocus);
  const [activeAgentId, setActiveAgentId] = useState<PredictionAgentId>("marine");
  const [messages, setMessages] = useState<AgentMessage[]>(() => initialMessages());
  const [scenarioPrompt, setScenarioPrompt] = useState(
    "What if sea surface temperature increases by 1 C across Arabian Sea, Bay of Bengal, and Lakshadweep? What would be the effects on the whole area?",
  );
  const [finalPrediction, setFinalPrediction] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const { data: agentsFromApi = [], isFetching } = useQuery({
    queryKey: ["prediction-agents"],
    queryFn: fetchPredictionAgents,
    staleTime: 10 * 60 * 1000,
  });
  const agents = useMemo(() => normalizeAgentOrder(agentsFromApi.length ? agentsFromApi : fallbackAgents), [agentsFromApi]);
  const agentMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);

  const analysisPrompt = useMemo(
    () =>
      `${scenarioPrompt.trim() || "Run the complete RAPID-AI prediction workflow."}\n` +
      (uploadedMarkers.length
        ? "Use the uploaded marine records as the primary evidence, and use live ocean context only where useful."
        : "Use the RAPID-AI screenshot dataset plus live ocean conditions for Arabian Sea, Bay of Bengal, and Lakshadweep."),
    [scenarioPrompt, uploadedMarkers.length],
  );

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!agents.length || autoStartedPredictionsRoom) return;
    autoStartedPredictionsRoom = true;
    void runWorkflow();
  }, [agents]);

  async function runWorkflow() {
    if (isRunning) return;
    const question = scenarioPrompt.trim() || "Run the complete RAPID-AI prediction workflow.";
    setIsRunning(true);
    setFinalPrediction("");
    const runMessages: AgentMessage[] = [
      ...initialMessages(),
      {
        id: `user-${Date.now()}`,
        agentId: "user",
        author: "You",
        role: "Scenario",
        content: question,
        status: "done",
      },
    ];
    setMessages(runMessages);

    const outputs: Partial<Record<PredictionAgentId, string>> = {};
    let endPrediction = "";
    let failed = false;
    for (const agentId of workflowOrder) {
      const agent = agentMap.get(agentId);
      if (!agent) continue;
      const previousAgentSummaries = compactAgentOutputs(outputs);
      const workingMessageId = `${agentId}-working-${Date.now()}`;
      focusAgentOnMap(agentId, agent.name);
      setActiveAgentId(agentId);
      setMessages((current) => [
        ...markPreviousDone(current),
        {
          id: workingMessageId,
          agentId,
          author: agent.name,
          role: agent.focus,
          content: `${agent.name} is working with ${agent.tools}. Formula: ${agent.formula ?? "RAPID-AI method"}.`,
          status: "working",
        },
      ]);

      try {
        const result = await runPredictionAgent(agentId, buildAgentPrompt(agent, previousAgentSummaries, analysisPrompt), {
          workflow_order: workflowOrder,
          previous_agent_outputs: previousAgentSummaries,
          uploaded_marker_count: uploadedMarkers.length,
          uploaded_locations: uploadedMarkers.slice(0, 12),
          uploaded_analysis: uploadAnalysis,
          prediction_room: true,
          debate_mode: true,
          required_formula: agent.formula,
        });
        const cleanResponse = cleanAgentResponse(result.response);
        outputs[agentId] = cleanResponse;
        if (agentId === "synthesis") {
          endPrediction = cleanResponse;
          setFinalPrediction(cleanResponse);
        }
        setMessages((current) =>
          current.map((message) =>
            message.id === workingMessageId
              ? { ...message, id: `${agentId}-done-${result.request_id}`, content: cleanResponse, status: "done" }
              : message.status === "working"
                ? { ...message, status: "done" }
                : message,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Agent analysis failed.";
        setMessages((current) =>
          current.map((item) =>
            item.id === workingMessageId
              ? { ...item, id: `${agentId}-error-${Date.now()}`, content: `Could not complete this stage. ${message}`, status: "error" }
              : item.status === "working"
                ? { ...item, status: "done" }
                : item,
          ),
        );
        failed = true;
        break;
      }
    }

    setMessages((current) => [
      ...markPreviousDone(current),
      {
        id: `outputs-${Date.now()}`,
        agentId: "outputs",
        author: "RAPID-AI Prediction Room",
        role: failed ? "Stopped" : "End Prediction",
        content: failed
          ? "The agent chain stopped before final synthesis. Please run again or shorten the scenario."
          : endPrediction || "Workflow complete. The final prediction is delivered here in the Predictions room.",
        status: failed ? "error" : "done",
      },
    ]);
    setIsRunning(false);
  }

  function focusAgentOnMap(agentId: PredictionAgentId, agentName?: string) {
    const target = agentMapTargets[agentId];
    setMapFocus({
      id: `prediction-${agentId}-${Date.now()}`,
      ...target,
      message: `${agentName ?? "RAPID-AI agent"} focusing map on ${target.label}.`,
    });
  }

  return (
    <section className="prediction-room glass-panel" aria-label="RAPID-AI prediction agent room">
      <aside className="prediction-room-sidebar" aria-label="Prediction channels">
        <header>
          <strong>RAPID-AI</strong>
          <small>Agent Room</small>
        </header>
        <nav>
          <span className="active"><Sparkles size={15} />agent-chat</span>
          <span><Database size={15} />evidence</span>
          <span><LayoutDashboard size={15} />side-output</span>
        </nav>
        <div className="prediction-room-sources">
          <strong>Sources</strong>
          <span>Copernicus</span>
          <span>INCOIS</span>
          <span>NOAA</span>
          <span>OBIS</span>
          <span>Database</span>
        </div>
      </aside>

      <main className="prediction-room-chat">
        <header>
          <div>
            <span><Database size={15} />Copernicus / INCOIS / NOAA to RAPID-AI Prediction Room</span>
            <h2>Predictions</h2>
            <p>Ask a scenario and the five RAPID-AI agents will debate it using their assigned mathematical methods.</p>
          </div>
          <Button type="button" onClick={() => void runWorkflow()} disabled={isRunning || isFetching}>
            <RefreshCw size={17} className={isRunning || isFetching ? "spin" : ""} />
            {isRunning ? "Agents Working" : "Run Workflow"}
          </Button>
        </header>

        <section className="prediction-flow-strip" aria-label="RAPID-AI workflow">
          <span>RAPID-AI</span>
          <i />
          {workflowOrder.map((agentId) => {
            const agent = agentMap.get(agentId);
            const Icon = agentIcons[agentId];
            return (
              <button
                key={agentId}
                type="button"
                className={activeAgentId === agentId ? "active" : ""}
                onClick={() => {
                  setActiveAgentId(agentId);
                  focusAgentOnMap(agentId, agent?.name);
                }}
              >
                <Icon size={15} />
                {agent?.letter}
              </button>
            );
          })}
          <i />
          <span>End Prediction</span>
        </section>

        <div ref={transcriptRef} className="prediction-transcript" aria-live="polite">
          {messages.map((message) => (
            <article key={message.id} className={`prediction-message ${message.status} ${message.agentId}`}>
              <div className="prediction-message-avatar">
                {message.agentId === "maris"
                  ? "AI"
                  : message.agentId === "sources"
                    ? "DB"
                    : message.agentId === "outputs"
                      ? "OK"
                      : message.agentId === "user"
                        ? "You"
                        : agentMap.get(message.agentId)?.letter}
              </div>
              <div>
                <header>
                  <strong>{message.author}</strong>
                  <small>{message.role}</small>
                  {message.status === "working" && <RefreshCw size={13} className="spin" />}
                  {message.status === "error" && <AlertTriangle size={13} />}
                </header>
                <p>{message.content}</p>
              </div>
            </article>
          ))}
        </div>

        <footer className="prediction-room-input">
          <textarea
            aria-label="Prediction scenario"
            value={scenarioPrompt}
            placeholder="Ask a scenario, e.g. what if temperature increases by 1 C?"
            onChange={(event) => setScenarioPrompt(event.currentTarget.value)}
          />
          <Button type="button" variant="icon" aria-label="Run RAPID-AI workflow" onClick={() => void runWorkflow()} disabled={isRunning}>
            <Send size={18} />
          </Button>
        </footer>
      </main>

      <aside className="prediction-side-screen" aria-label="Prediction side output">
        <section className="prediction-end-output">
          <small>End Prediction</small>
          <strong>{finalPrediction ? "Synthesis ready" : isRunning ? "Agents working" : "Awaiting run"}</strong>
          <p>{finalPrediction || "The final answer from the Synthesis Agent will stay here after all five agents work together."}</p>
        </section>

        <div className="prediction-agent-stack" aria-label="Agent status">
          {workflowOrder.map((agentId) => {
            const agent = agentMap.get(agentId);
            const Icon = agentIcons[agentId];
            return (
              <button
                key={agentId}
                type="button"
                className={activeAgentId === agentId ? "active" : ""}
                onClick={() => {
                  setActiveAgentId(agentId);
                  focusAgentOnMap(agentId, agent?.name);
                }}
              >
                <span>{agent?.letter}</span>
                <Icon size={17} />
                <strong>{agent?.name}</strong>
                <small>{agent?.focus}</small>
                {agent?.formula && <em>{agent.formula}</em>}
              </button>
            );
          })}
        </div>
      </aside>
    </section>
  );
}

function normalizeAgentOrder(agents: PredictionAgent[]) {
  return workflowOrder
    .map((agentId) => agents.find((agent) => agent.id === agentId))
    .filter((agent): agent is PredictionAgent => Boolean(agent));
}

function initialMessages(): AgentMessage[] {
  const messages: AgentMessage[] = [
    {
      id: "maris-ready",
      agentId: "maris",
      author: "RAPID-AI",
      role: "Orchestrator",
      content: "Prediction room opened. The workflow will move from ocean data sources through 🌊, 📊, 🧠, 🔮, and 🧩 agents.",
      status: "done",
    },
    {
      id: "sources-ready",
      agentId: "sources",
      author: "Source Feed",
      role: "Copernicus / INCOIS / NOAA / OBIS / Database",
      content: "Live ocean signals and uploaded records are queued for the RAPID-AI agent chain.",
      status: "done",
    },
  ];

  return messages.map((message) =>
    message.id === "maris-ready"
      ? {
          ...message,
          content: "Prediction room opened. The workflow will move from ocean data sources through the five specialist agents and finish here.",
        }
      : message,
  );
}

function markPreviousDone(messages: AgentMessage[]) {
  return messages.map((message) => (message.status === "working" ? { ...message, status: "done" as const } : message));
}

function buildAgentPrompt(
  agent: PredictionAgent,
  previousOutputs: Partial<Record<PredictionAgentId, string>>,
  basePrompt: string,
) {
  return (
    `${basePrompt}\n\n` +
    `You are running in this systematic RAPID-AI order: Copernicus/INCOIS/NOAA -> Marine Agent -> ` +
    `OBIS/Database -> Analytics Agent -> Reasoning Agent -> Intelligence Agent ML Prediction -> Synthesis Agent -> End Prediction in this room.\n` +
    `Current stage: ${agent.letter} - ${agent.name}.\n` +
    `Required formula/method: ${agent.formula ?? agent.tools}.\n` +
    `Previous stage summaries: ${JSON.stringify(previousOutputs)}\n` +
    `${agentCollaborationDirective(agent.id)} ` +
    "Debate the scenario: agree with, challenge, or refine one previous stage when available. " +
    "Use the required formula/method explicitly, then explain whole-area effects on temperature, chlorophyll, biodiversity, and ocean health where relevant. " +
    "Do not use markdown, asterisks, bullet symbols, or numbered lists. Reply like a professional ChatGPT answer using 4 short labeled lines max, with ASCII units like C and +/-."
  );
}

function agentCollaborationDirective(agentId: PredictionAgentId) {
  if (agentId === "reasoning") {
    return "Reasoning Agent must use Bayes evidence to explain cause, confidence, and uncertainty behind the earlier observations.";
  }
  if (agentId === "intelligence") {
    return "Intelligence Agent must use the earlier reasoning plus regression, moving average, RMSE, and MAE evidence to forecast trend and anomaly risk.";
  }
  if (agentId === "synthesis") {
    return "Synthesis Agent must combine Marine, Analytics, Reasoning, and Intelligence into one final end prediction for this side screen.";
  }
  return "Work as one stage in a shared RAPID-AI chain and hand off the most important evidence to the next agent.";
}

function cleanAgentResponse(response: string) {
  return response
    .replace(/\*/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactAgentOutputs(outputs: Partial<Record<PredictionAgentId, string>>) {
  return Object.fromEntries(
    Object.entries(outputs).map(([agentId, output]) => [
      agentId,
      output && output.length > maxAgentOutputChars ? `${output.slice(0, maxAgentOutputChars)}...` : output,
    ]),
  ) as Partial<Record<PredictionAgentId, string>>;
}
