import { TFile, type EventRef } from "obsidian";
import type TaskNotesPlugin from "../main";
import { EVENT_TASK_UPDATED, type TaskInfo } from "../types";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { inferInclusiveDateRangeMinutes } from "../utils/naturalLanguageDateRange";

const tasknotesLogger = createTaskNotesLogger({
	tag: "Services/TaskFileLifecycleReconciliationService",
});

type Nullable<T> = T | null;

type TaskUpdatePayload = {
	path?: string;
	task?: TaskInfo;
	taskInfo?: TaskInfo;
	updatedTask?: TaskInfo;
	originalTask?: TaskInfo;
};

type FileRenamedPayload = {
	oldPath?: string;
	newPath?: string;
	file?: TFile;
};

const RECONCILED_TASK_FIELDS = [
	"status",
	"title",
	"scheduled",
	"due",
	"priority",
	"recurrence",
	"complete_instances",
	"skipped_instances",
	"timeEstimate",
	"tags",
	"contexts",
	"projects",
] as const satisfies readonly (keyof TaskInfo)[];

type ReconciledTaskField = (typeof RECONCILED_TASK_FIELDS)[number];

function taskFromPayload(payload: TaskUpdatePayload): TaskInfo | undefined {
	return payload.updatedTask ?? payload.taskInfo ?? payload.task;
}

function normalizeForComparison(value: unknown): unknown {
	if (value === undefined) {
		return null;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => normalizeForComparison(entry));
	}

	if (value && typeof value === "object") {
		const objectValue = value as Record<string, unknown>;
		return Object.keys(objectValue)
			.sort()
			.reduce<Record<string, unknown>>((normalized, key) => {
				normalized[key] = normalizeForComparison(objectValue[key]);
				return normalized;
			}, {});
	}

	return value;
}

function taskValuesEqual(left: unknown, right: unknown): boolean {
	return (
		JSON.stringify(normalizeForComparison(left)) ===
		JSON.stringify(normalizeForComparison(right))
	);
}

export function selectReconciledTaskProperty(
	originalTask: TaskInfo,
	updatedTask: TaskInfo
): ReconciledTaskField | null {
	return (
		RECONCILED_TASK_FIELDS.find(
			(field) => !taskValuesEqual(originalTask[field], updatedTask[field])
		) ?? null
	);
}

export class TaskFileLifecycleReconciliationService {
	private readonly taskSnapshots = new Map<string, TaskInfo>();
	private taskUpdatedRef: Nullable<EventRef> = null;
	private fileRenamedRef: Nullable<EventRef> = null;
	private readonly handlingPaths = new Set<string>();
	private readonly inferringTimeEstimatePaths = new Set<string>();

	constructor(private readonly plugin: TaskNotesPlugin) {}

	async initialize(): Promise<void> {
		await this.captureCurrentTasks();
		this.taskUpdatedRef = this.plugin.emitter.on(
			EVENT_TASK_UPDATED,
			(payload: TaskUpdatePayload) => {
				void this.handleTaskUpdatedEvent(payload);
			}
		);
		this.fileRenamedRef = this.plugin.emitter.on(
			"file-renamed",
			(payload: FileRenamedPayload) => {
				void this.handleFileRenamedEvent(payload);
			}
		);
	}

	destroy(): void {
		if (this.taskUpdatedRef) {
			this.plugin.emitter.offref(this.taskUpdatedRef);
			this.taskUpdatedRef = null;
		}
		if (this.fileRenamedRef) {
			this.plugin.emitter.offref(this.fileRenamedRef);
			this.fileRenamedRef = null;
		}
		this.handlingPaths.clear();
		this.inferringTimeEstimatePaths.clear();
		this.taskSnapshots.clear();
	}

	async handleTaskUpdatedEvent(payload: TaskUpdatePayload): Promise<void> {
		const updatedTask = taskFromPayload(payload);
		const path = payload.path ?? updatedTask?.path;
		if (!path || !updatedTask) {
			return;
		}

		if (payload.originalTask) {
			if (payload.originalTask.path !== path) {
				this.taskSnapshots.delete(payload.originalTask.path);
			}
			this.taskSnapshots.set(path, updatedTask);
			return;
		}

		const originalTask = this.taskSnapshots.get(path);
		this.taskSnapshots.set(path, updatedTask);

		if (!originalTask || this.handlingPaths.has(path)) {
			return;
		}

		if (originalTask.title !== updatedTask.title) {
			await this.applyInferredTimeEstimate(updatedTask);
		}

		const property = selectReconciledTaskProperty(originalTask, updatedTask);
		if (!property) {
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return;
		}

		this.handlingPaths.add(path);
		try {
			await this.plugin.taskService.applyPropertyChangeSideEffects(
				file,
				originalTask,
				updatedTask,
				property,
				originalTask[property],
				updatedTask[property]
			);
		} catch (error) {
			tasknotesLogger.warn("Failed to reconcile direct task file edit:", {
				category: "persistence",
				operation: "reconcile-direct-task-file-edit",
				details: { taskPath: path, property },
				error,
			});
		} finally {
			this.handlingPaths.delete(path);
		}
	}

	async handleFileRenamedEvent(payload: FileRenamedPayload): Promise<void> {
		const file = payload.file;
		if (!(file instanceof TFile) || file.extension !== "md") {
			return;
		}

		if (payload.oldPath) {
			this.taskSnapshots.delete(payload.oldPath);
		}

		const task = await this.plugin.cacheManager.getTaskInfo(file.path);
		if (!task) {
			return;
		}

		const renamedTask = this.plugin.settings.storeTitleInFilename
			? { ...task, title: file.basename }
			: task;
		this.taskSnapshots.set(file.path, renamedTask);
		await this.applyInferredTimeEstimate(renamedTask);
	}

	private async applyInferredTimeEstimate(task: TaskInfo): Promise<void> {
		const inferredMinutes = inferInclusiveDateRangeMinutes(
			task.title,
			task.scheduled || task.due
		);
		if (
			inferredMinutes === undefined ||
			task.timeEstimate === inferredMinutes ||
			this.inferringTimeEstimatePaths.has(task.path)
		) {
			return;
		}

		this.inferringTimeEstimatePaths.add(task.path);
		try {
			const updatedTask = await this.plugin.updateTaskProperty(
				task,
				"timeEstimate",
				inferredMinutes,
				{ silent: true }
			);
			this.taskSnapshots.set(updatedTask.path, updatedTask);
		} catch (error) {
			tasknotesLogger.warn("Failed to infer time estimate from task note title:", {
				category: "persistence",
				operation: "infer-time-estimate-from-note-title",
				details: { taskPath: task.path },
				error,
			});
		} finally {
			this.inferringTimeEstimatePaths.delete(task.path);
		}
	}

	private async captureCurrentTasks(): Promise<void> {
		try {
			const tasks = await this.plugin.cacheManager.getAllTasks();
			for (const task of tasks) {
				this.taskSnapshots.set(task.path, task);
			}
		} catch (error) {
			tasknotesLogger.warn("Failed to snapshot tasks for direct file edit reconciliation:", {
				category: "stale-data",
				operation: "snapshot-direct-task-file-reconciliation",
				error,
			});
		}
	}
}
