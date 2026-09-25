import { registerRibbonIcons } from "../../../src/bootstrap/pluginBootstrap";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import type TaskNotesPlugin from "../../../src/main";

const NEW_TAB = { openInNewTab: true };

describe("TaskNotes command and ribbon navigation", () => {
	it("requests a new tab for every command-palette action that opens a view or note", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as TaskNotesPlugin);
		const ctx = {
			activateCalendarView: jest.fn(),
			openBasesFileForCommand: jest.fn(),
			activatePomodoroView: jest.fn(),
			activatePomodoroStatsView: jest.fn(),
			activateStatsView: jest.fn(),
			navigateToCurrentDailyNote: jest.fn(),
			activateReleaseNotesView: jest.fn(),
			openTaskSelectorWithCreate: jest.fn(),
			openTaskSelectorWithCreateAndStartTracking: jest.fn(),
			openTaskCreationModal: jest.fn(),
		};
		const commandIds = [
			"open-calendar-view",
			"open-advanced-calendar-view",
			"open-tasks-view",
			"open-agenda-view",
			"open-pomodoro-view",
			"open-kanban-view",
			"open-pomodoro-stats",
			"open-statistics",
			"go-to-today",
			"view-release-notes",
			"create-or-open-task",
			"create-or-open-task-with-time-tracking",
			"create-new-task",
		];

		for (const id of commandIds) {
			await definitions.find((definition) => definition.id === id)?.callback?.(ctx as never);
		}

		expect(ctx.activateCalendarView).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.openBasesFileForCommand).toHaveBeenCalledWith(
			"open-advanced-calendar-view",
			NEW_TAB
		);
		expect(ctx.openBasesFileForCommand).toHaveBeenCalledWith("open-tasks-view", NEW_TAB);
		expect(ctx.openBasesFileForCommand).toHaveBeenCalledWith("open-agenda-view", NEW_TAB);
		expect(ctx.openBasesFileForCommand).toHaveBeenCalledWith("open-kanban-view", NEW_TAB);
		expect(ctx.activatePomodoroView).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.activatePomodoroStatsView).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.activateStatsView).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.navigateToCurrentDailyNote).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.activateReleaseNotesView).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.openTaskSelectorWithCreate).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.openTaskSelectorWithCreateAndStartTracking).toHaveBeenCalledWith(NEW_TAB);
		expect(ctx.openTaskCreationModal).toHaveBeenCalledWith(undefined, {
			openCreatedTaskInNewTab: true,
		});
	});

	it("requests a new tab for every ribbon action that opens a view", async () => {
		const ribbonCallbacks: Array<() => void | Promise<void>> = [];
		const plugin = {
			i18n: { translate: jest.fn((key: string) => key) },
			addRibbonIcon: jest.fn(
				(_icon: string, _title: string, callback: () => void | Promise<void>) => {
					ribbonCallbacks.push(callback);
				}
			),
			activateCalendarView: jest.fn(),
			openBasesFileForCommand: jest.fn(),
			activatePomodoroView: jest.fn(),
			activatePomodoroStatsView: jest.fn(),
			openTaskCreationModal: jest.fn(),
		} as unknown as TaskNotesPlugin;

		registerRibbonIcons(plugin);
		for (const callback of ribbonCallbacks) {
			await callback();
		}

		expect(plugin.activateCalendarView).toHaveBeenCalledWith(NEW_TAB);
		expect(plugin.openBasesFileForCommand).toHaveBeenCalledWith(
			"open-advanced-calendar-view",
			NEW_TAB
		);
		expect(plugin.openBasesFileForCommand).toHaveBeenCalledWith("open-tasks-view", NEW_TAB);
		expect(plugin.openBasesFileForCommand).toHaveBeenCalledWith("open-agenda-view", NEW_TAB);
		expect(plugin.openBasesFileForCommand).toHaveBeenCalledWith("open-kanban-view", NEW_TAB);
		expect(plugin.activatePomodoroView).toHaveBeenCalledWith(NEW_TAB);
		expect(plugin.activatePomodoroStatsView).toHaveBeenCalledWith(NEW_TAB);
		expect(plugin.openTaskCreationModal).toHaveBeenCalledWith(undefined, {
			openCreatedTaskInNewTab: true,
		});
	});
});
