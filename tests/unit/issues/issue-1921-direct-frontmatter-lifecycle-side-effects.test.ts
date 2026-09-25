import { TFile } from "../../helpers/obsidian-runtime";
import {
	selectReconciledTaskProperty,
	TaskFileLifecycleReconciliationService,
} from "../../../src/services/TaskFileLifecycleReconciliationService";
import { EVENT_TASK_UPDATED, type TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Direct edit task",
		status: "ready",
		priority: "normal",
		path: "TaskNotes/Tasks/direct-edit.md",
		archived: false,
		scheduled: "2026-05-18",
		googleCalendarEventId: "existing-event-id",
		...overrides,
	} as TaskInfo;
}

function createEmitter() {
	let taskUpdatedHandler: ((payload: unknown) => void) | undefined;
	let fileRenamedHandler: ((payload: unknown) => void) | undefined;

	return {
		on: jest.fn((event: string, handler: (payload: unknown) => void) => {
			if (event === EVENT_TASK_UPDATED) {
				taskUpdatedHandler = handler;
			} else if (event === "file-renamed") {
				fileRenamedHandler = handler;
			}
			return { event, handler };
		}),
		offref: jest.fn(),
		triggerTaskUpdated(payload: unknown) {
			taskUpdatedHandler?.(payload);
		},
		triggerFileRenamed(payload: unknown) {
			fileRenamedHandler?.(payload);
		},
	};
}

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

function createPlugin(initialTasks: TaskInfo[] = []) {
	const file = new TFile("TaskNotes/Tasks/direct-edit.md");
	const emitter = createEmitter();
	const taskService = {
		applyPropertyChangeSideEffects: jest.fn().mockResolvedValue(undefined),
	};
	const updateTaskProperty = jest.fn(
		async (task: TaskInfo, property: keyof TaskInfo, value: TaskInfo[keyof TaskInfo]) => ({
			...task,
			[property]: value,
		})
	);
	const plugin = {
		app: {
			vault: {
				getAbstractFileByPath: jest.fn(() => file),
			},
		},
		cacheManager: {
			getAllTasks: jest.fn().mockResolvedValue(initialTasks),
			getTaskInfo: jest.fn().mockResolvedValue(initialTasks[0] ?? null),
		},
		settings: { storeTitleInFilename: true },
		emitter,
		taskService,
		updateTaskProperty,
	};

	return { emitter, file, plugin, taskService, updateTaskProperty };
}

describe("Issue #1921: direct frontmatter edits trigger lifecycle side effects", () => {
	it("selects status before other changed fields so completion uses completion side effects", () => {
		const originalTask = createTask({ status: "ready", title: "Original" });
		const updatedTask = createTask({
			status: "done",
			title: "Updated",
			completedDate: "2026-05-18",
		});

		expect(selectReconciledTaskProperty(originalTask, updatedTask)).toBe("status");
	});

	it("routes direct status completion through the existing TaskService side-effect path", async () => {
		const originalTask = createTask({ status: "ready" });
		const updatedTask = createTask({
			status: "done",
			completedDate: "2026-05-18",
		});
		const { emitter, file, plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		emitter.triggerTaskUpdated({
			path: updatedTask.path,
			updatedTask,
		});
		await flushPromises();

		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledWith(
			file,
			originalTask,
			updatedTask,
			"status",
			"ready",
			"done"
		);

		service.destroy();
	});

	it("routes direct calendar-visible metadata changes through the update side-effect path", async () => {
		const originalTask = createTask({ scheduled: "2026-05-18" });
		const updatedTask = createTask({ scheduled: "2026-05-19" });
		const { file, plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		await service.handleTaskUpdatedEvent({
			path: updatedTask.path,
			updatedTask,
		});

		expect(taskService.applyPropertyChangeSideEffects).toHaveBeenCalledWith(
			file,
			originalTask,
			updatedTask,
			"scheduled",
			"2026-05-18",
			"2026-05-19"
		);

		service.destroy();
	});

	it("does not rerun side effects for TaskService-originated update events", async () => {
		const originalTask = createTask({ status: "ready" });
		const updatedTask = createTask({ status: "done" });
		const { plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		await service.handleTaskUpdatedEvent({
			path: updatedTask.path,
			originalTask,
			updatedTask,
		});

		expect(taskService.applyPropertyChangeSideEffects).not.toHaveBeenCalled();

		service.destroy();
	});

	it("ignores Google Calendar event id bookkeeping changes", async () => {
		const originalTask = createTask({ googleCalendarEventId: undefined });
		const updatedTask = createTask({ googleCalendarEventId: "new-event-id" });
		const { plugin, taskService } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		await service.handleTaskUpdatedEvent({
			path: updatedTask.path,
			updatedTask,
		});

		expect(taskService.applyPropertyChangeSideEffects).not.toHaveBeenCalled();

		service.destroy();
	});

	it("updates the estimate when an open task note is renamed with a date range", async () => {
		const originalTask = createTask({
			path: "TaskNotes/Tasks/Naomi away.md",
			scheduled: "2026-09-14",
			timeEstimate: 60,
		});
		const { plugin, updateTaskProperty } = createPlugin([originalTask]);
		const service = new TaskFileLifecycleReconciliationService(plugin as any);
		const renamedFile = new TFile(
			"TaskNotes/Tasks/Naomi away from 14th to the 27th.md"
		);
		plugin.cacheManager.getTaskInfo.mockResolvedValue({
			...originalTask,
			path: renamedFile.path,
		});

		await service.initialize();
		await service.handleFileRenamedEvent({
			oldPath: originalTask.path,
			newPath: renamedFile.path,
			file: renamedFile,
		});

		expect(updateTaskProperty).toHaveBeenCalledWith(
			expect.objectContaining({
				path: renamedFile.path,
				title: "Naomi away from 14th to the 27th",
			}),
			"timeEstimate",
			14 * 24 * 60,
			{ silent: true }
		);

		service.destroy();
	});

	it("updates the estimate when a task title is edited directly in frontmatter", async () => {
		const originalTask = createTask({
			title: "Naomi away",
			scheduled: "2026-09-14",
			timeEstimate: 60,
		});
		const updatedTask = createTask({
			title: "Naomi away from 14th to the 27th",
			scheduled: "2026-09-14",
			timeEstimate: 60,
		});
		const { plugin, updateTaskProperty } = createPlugin([originalTask]);
		plugin.settings.storeTitleInFilename = false;
		const service = new TaskFileLifecycleReconciliationService(plugin as any);

		await service.initialize();
		await service.handleTaskUpdatedEvent({
			path: updatedTask.path,
			updatedTask,
		});

		expect(updateTaskProperty).toHaveBeenCalledWith(
			updatedTask,
			"timeEstimate",
			14 * 24 * 60,
			{ silent: true }
		);

		service.destroy();
	});
});
