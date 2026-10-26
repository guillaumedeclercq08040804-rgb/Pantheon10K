/**
 * Pantheon-10K VS Code & Cursor Extension (Ctrl+Shift+M)
 * Fetches verified M_000 Crown solutions from the decentralized swarm.
 */

export interface ExtensionContext {
  subscriptions: { dispose(): any }[];
}

export function activate(context: any) {
  // If running in VS Code runtime
  const vscode = (globalThis as any).vscode || require("vscode");

  const solveErrorCommand = vscode.commands.registerCommand("monolith10k.solveError", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("Pantheon-10K: Open a file with compiler/test errors to query the swarm.");
      return;
    }

    const selection = editor.document.getText(editor.selection);
    const queryText = selection || editor.document.lineAt(editor.selection.active.line).text;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Pantheon-10K: Querying M_000 Crown Solution...",
        cancellable: false,
      },
      async () => {
        try {
          const config = vscode.workspace.getConfiguration("pantheon10k");
          const endpoint = config.get("endpoint") || "https://pantheon10k.org";

          // Hash query text or search by coordinate
          const res = await fetch(`${endpoint}/T_0001/S_00`);
          if (!res.ok) {
            vscode.window.showErrorMessage(`Pantheon-10K: Endpoint returned status ${res.status}`);
            return;
          }

          const data = await res.json() as any;
          if (data.crown) {
            const action = await vscode.window.showInformationMessage(
              `👑 [M_000 Crown Found] ${data.crown.summary}`,
              "Apply Patch",
              "View Blob Details"
            );

            if (action === "Apply Patch") {
              editor.edit((editBuilder: any) => {
                editBuilder.insert(editor.selection.end, `\n// --- Verified M_000 Synthesis Patch ---\n// Hash: ${data.crown.msg_hash}\n`);
              });
            } else if (action === "View Blob Details") {
              vscode.env.openExternal(vscode.Uri.parse(`${endpoint}${data.crown.blob_url}`));
            }
          } else {
            vscode.window.showInformationMessage("Pantheon-10K: No M_000 Crown yet. Post proposal or barter to initiate topic.");
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(`Pantheon-10K Error: ${err.message}`);
        }
      }
    );
  });

  const viewBadgeCommand = vscode.commands.registerCommand("monolith10k.viewBadge", async () => {
    const vscode = (globalThis as any).vscode || require("vscode");
    const config = vscode.workspace.getConfiguration("pantheon10k");
    const endpoint = config.get("endpoint") || "https://pantheon10k.org";
    const pubkey = config.get("agentPubkey") || "";

    if (!pubkey) {
      vscode.window.showInputBox({ prompt: "Enter agent Ed25519 public key hex:" }).then((enteredKey: string) => {
        if (enteredKey) {
          vscode.env.openExternal(vscode.Uri.parse(`${endpoint}/agent/${enteredKey}/badge.json`));
        }
      });
      return;
    }

    vscode.env.openExternal(vscode.Uri.parse(`${endpoint}/agent/${pubkey}/badge.json`));
  });

  context.subscriptions.push(solveErrorCommand, viewBadgeCommand);
}

export function deactivate() {}
