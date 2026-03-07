import { describe, expect, it } from "vitest";
import { bytesLabel, compactRuntimeName, speedLabel, validateRuntime } from "./format";

describe("format helpers", () => {
  it("formats bytes and speeds", () => {
    expect(bytesLabel(1024 * 1024)).toBe("1.0 MB");
    expect(speedLabel(2048)).toBe("2.0 KB/s");
    expect(compactRuntimeName("llama_cpp")).toBe("llama.cpp");
  });

  it("validates runtime settings", () => {
    expect(
      validateRuntime({
        runtime_kind: "llama_cpp",
        server_base_url: "http://127.0.0.1:8080",
        llama_server_path: null,
        vllm_python_path: null,
        vllm_model_path: null,
        vllm_args: "",
        huggingface_token: null,
        download_dir: "models",
        system_prompt: null,
        user_profile: { username: "user", avatar_url: null }
      })
    ).toBe("Select a llama-server executable or use auto-download.");
  });
});
