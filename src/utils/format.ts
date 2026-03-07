import type { RuntimeSettings, RuntimeKind } from "../types";

export function bytesLabel(value: number) {
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function speedLabel(bytesPerSecond: number) {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  }
  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
}

export function compactRuntimeName(runtime: RuntimeKind) {
  return runtime === "llama_cpp" ? "llama.cpp" : "vLLM";
}

export function formatTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  });
}

export function validateRuntime(runtime: RuntimeSettings) {
  if (!runtime.server_base_url.trim()) {
    return "Server URL is required.";
  }

  try {
    const url = new URL(runtime.server_base_url);
    if (!url.protocol.startsWith("http")) {
      return "Server URL must use http or https.";
    }
  } catch {
    return "Server URL is invalid.";
  }

  if (!runtime.download_dir.trim()) {
    return "Download directory is required.";
  }

  if (runtime.runtime_kind === "llama_cpp" && !runtime.llama_server_path?.trim()) {
    return "Select a llama-server executable or use auto-download.";
  }

  if (runtime.runtime_kind === "vllm" && !runtime.vllm_python_path?.trim()) {
    return "Select a Python executable for vLLM.";
  }

  return null;
}
