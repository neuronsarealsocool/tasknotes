import { TFile } from "obsidian";
import { WorkspaceNavigationService } from "../../../src/ui/WorkspaceNavigationService";
import type TaskNotesPlugin from "../../../src/main";

describe("Issue #1429: view commands open Base files in a new tab", () => {
	it("opens configured Base command files without replacing the active leaf", async () => {
		const file = new TFile("TaskNotes/Views/tasks-default.base");
		const activeLeaf = { openFile: jest.fn() };
		const newTabLeaf = { openFile: jest.fn() };
		const getLeaf = jest.fn((leafType?: string) =>
			leafType === "tab" ? newTabLeaf : activeLeaf
		);

		const plugin = {
			settings: {
				commandFileMapping: {
					"open-tasks-view": "TaskNotes/Views/tasks-default.base",
				},
			},
			app: {
				vault: {
					adapter: {
						exists: jest.fn().mockResolvedValue(true),
					},
					getAbstractFileByPath: jest.fn().mockReturnValue(file),
				},
				workspace: {
					getLeaf,
				},
			},
		} as unknown as TaskNotesPlugin;

		await new WorkspaceNavigationService(plugin).openBasesFileForCommand("open-tasks-view");

		expect(getLeaf).toHaveBeenCalledWith("tab");
		expect(newTabLeaf.openFile).toHaveBeenCalledWith(file);
		expect(activeLeaf.openFile).not.toHaveBeenCalled();
	});

	it("forces a fresh tab even when the same Base file is already open", async () => {
		const file = new TFile("TaskNotes/Views/tasks-default.base");
		const existingLeaf = {
			view: { file },
			loadIfDeferred: jest.fn(),
		};
		const newTabLeaf = { openFile: jest.fn() };
		const workspace = {
			iterateAllLeaves: jest.fn((visitor: (leaf: typeof existingLeaf) => void) => {
				visitor(existingLeaf);
			}),
			getLeaf: jest.fn(() => newTabLeaf),
			setActiveLeaf: jest.fn(),
			revealLeaf: jest.fn(),
		};
		const plugin = {
			settings: {
				commandFileMapping: {
					"open-tasks-view": file.path,
				},
			},
			app: {
				vault: {
					adapter: { exists: jest.fn().mockResolvedValue(true) },
					getAbstractFileByPath: jest.fn().mockReturnValue(file),
				},
				workspace,
			},
		} as unknown as TaskNotesPlugin;

		await new WorkspaceNavigationService(plugin).openBasesFileForCommand(
			"open-tasks-view",
			{ openInNewTab: true }
		);

		expect(workspace.getLeaf).toHaveBeenCalledWith("tab");
		expect(newTabLeaf.openFile).toHaveBeenCalledWith(file);
		expect(workspace.setActiveLeaf).not.toHaveBeenCalled();
	});
});
