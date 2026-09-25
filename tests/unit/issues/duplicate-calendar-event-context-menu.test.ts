import { App, Menu } from "obsidian";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import {
	buildDuplicateTaskData,
	TaskContextMenu,
} from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

type MockMenuItem = {
	setTitle?: jest.Mock;
	onClick?: jest.Mock;
};

const menuMock = Menu as unknown as jest.Mock;

function createSourceTask(): TaskInfo {
	return {
		id: "Tasks/calendar-event.md",
		path: "Tasks/calendar-event.md",
		title: "Calendar event",
		status: "open",
		priority: "high",
		archived: false,
		scheduled: "2026-09-22T09:00:00",
		due: "2026-09-22T10:00:00",
		tags: ["event"],
		contexts: ["work"],
		projects: ["[[Project]]"],
		reminders: [
			{
				id: "rem_original",
				type: "absolute",
				absoluteTime: "2026-09-22T08:55:00",
				alert: {
					style: "fullscreen",
					note: "Get ready",
					video: "(Calendar/TaskNotes Companion/Media/alert.mp4",
					audioLoop: true,
				},
			},
		],
		details: "Event details",
		customProperties: { location: "Studio", nested: { value: 1 } },
		complete_instances: ["2026-09-15"],
		timeEntries: [{ startTime: "2026-09-20T09:00:00" }],
		googleCalendarEventId: "external-id",
	};
}

function createPlugin(createTask: jest.Mock): TaskNotesPlugin {
	return {
		app: new App(),
		i18n: createI18nService(),
		settings: {
			customStatuses: [],
			customPriorities: [],
			calendarViewSettings: { enableTimeblocking: false },
			useFrontmatterMarkdownLinks: true,
		},
		statusManager: {
			getAllStatuses: jest.fn(() => []),
			getNonCompletionStatuses: jest.fn(() => []),
			isCompletedStatus: jest.fn(() => false),
		},
		priorityManager: {
			getAllPriorities: jest.fn(() => []),
			getPrioritiesByWeight: jest.fn(() => []),
		},
		taskService: {
			createTask,
			toggleRecurringTaskSkipped: jest.fn(),
			updateBlockingRelationships: jest.fn(),
			deleteTask: jest.fn(),
		},
		cacheManager: {
			getAllContexts: jest.fn(() => []),
			getAllTasks: jest.fn(() => []),
			getTaskInfo: jest.fn(),
		},
		updateTaskProperty: jest.fn(),
		toggleRecurringTaskComplete: jest.fn(),
		getActiveTimeSession: jest.fn(() => null),
		stopTimeTracking: jest.fn(),
		startTimeTracking: jest.fn(),
		openDueDateModal: jest.fn(),
		openScheduledDateModal: jest.fn(),
		openTimeEntryEditor: jest.fn(),
		toggleTaskArchive: jest.fn(),
		openTaskEditModal: jest.fn(),
		openTaskCreationModal: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

describe("calendar event duplication", () => {
	beforeEach(() => {
		MockObsidian.reset();
		menuMock.mockClear();
	});

	afterEach(() => {
		MockObsidian.reset();
		menuMock.mockClear();
	});

	it("copies editable event data without source identity or history", () => {
		const source = createSourceTask();
		const duplicate = buildDuplicateTaskData(source);

		expect(duplicate).toMatchObject({
			title: `${source.title} duplicate`,
			scheduled: source.scheduled,
			due: source.due,
			details: source.details,
			customFrontmatter: source.customProperties,
		});
		expect(duplicate.reminders?.[0].id).not.toBe(source.reminders?.[0].id);
		expect(duplicate.reminders?.[0].alert).toEqual(source.reminders?.[0].alert);
		expect(duplicate).not.toHaveProperty("path");
		expect(duplicate).not.toHaveProperty("complete_instances");
		expect(duplicate).not.toHaveProperty("timeEntries");
		expect(duplicate).not.toHaveProperty("googleCalendarEventId");
	});

	it("creates a duplicate from the context-menu action", async () => {
		const createTaskMock = jest.fn().mockResolvedValue({});
		const onUpdate = jest.fn();
		const source = createSourceTask();

		new TaskContextMenu({
			task: source,
			plugin: createPlugin(createTaskMock),
			targetDate: new Date("2026-09-22T09:00:00"),
			onUpdate,
		});

		const menu = menuMock.mock.results[0].value as { items: MockMenuItem[] };
		const duplicateItem = menu.items.find((item) =>
			item.setTitle?.mock.calls.some(([title]) => title === "Duplicate event")
		);
		expect(duplicateItem).toBeDefined();

		await duplicateItem?.onClick?.mock.calls[0][0]();

		expect(createTaskMock).toHaveBeenCalledWith(
			expect.objectContaining({
				title: `${source.title} duplicate`,
				scheduled: source.scheduled,
			}),
			{ applyDefaults: false, applyTemplate: false }
		);
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});
});
