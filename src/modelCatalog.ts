import type { CatalogModel } from "./types";

export const MODEL_CATALOG: CatalogModel[] = [
  {
    id: "llama32-3b-q4",
    title: "Llama 3.2 3B Instruct",
    repoId: "bartowski/Llama-3.2-3B-Instruct-GGUF",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    runtimeHint: "llama_cpp",
    summary: "Lightweight CPU preset for local chat on laptops and desktops.",
    tags: ["chat", "cpu", "gguf"],
    size: "2.0 GB"
  },
  {
    id: "qwen25-7b-q4",
    title: "Qwen 2.5 7B Instruct",
    repoId: "bartowski/Qwen2.5-7B-Instruct-GGUF",
    filename: "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    runtimeHint: "llama_cpp",
    summary: "Balanced model with stronger reasoning and coding than compact 3B presets.",
    tags: ["reasoning", "code", "gguf"],
    size: "4.7 GB"
  },
  {
    id: "mistral-7b-instruct",
    title: "Mistral 7B Instruct v0.3",
    repoId: "bartowski/Mistral-7B-Instruct-v0.3-GGUF",
    filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    runtimeHint: "llama_cpp",
    summary: "Fast general-purpose preset with good chat quality.",
    tags: ["general", "fast", "gguf"],
    size: "4.4 GB"
  },
  {
    id: "deepseek-r1-distill-qwen-7b",
    title: "DeepSeek R1 Distill Qwen 7B",
    repoId: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
    filename: "DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
    runtimeHint: "llama_cpp",
    summary: "Reasoning-focused preset for more demanding analysis tasks.",
    tags: ["reasoning", "analysis", "gguf"],
    size: "4.8 GB"
  },
  {
    id: "vllm-qwen32b",
    title: "Qwen 2.5 32B Instruct",
    repoId: "Qwen/Qwen2.5-32B-Instruct",
    filename: "Use Hugging Face model id in vLLM settings",
    runtimeHint: "vllm",
    summary: "GPU-oriented option for vLLM. Configure Python and model path separately.",
    tags: ["gpu", "vllm", "large"],
    size: "transformers"
  }
];
