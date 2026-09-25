import { App } from "obsidian";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	cleanupCalendarClickTimeout,
	handleCalendarTaskClick,
} from "../../../src/utils/clickHandlers";

describe("calendar task double-click handling", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	afterEach(() => {
		cleanupCalendarClickTimeout("calendar-event");
		MockObsidian.reset();
	});

	it("opens the event note in a new tab on double-click", async () => {
		const app = new App();
		const task: TaskInfo = {
			path: "Tasks/calendar-event.md",
			title: "Calendar event",
			status: "open",
			priority: "normal",
			archived: false,
		};
		await app.vault.create(task.path, "");
		const openLinkText = jest.fn();
		(app.workspace as typeof app.workspace & { openLinkText: jest.Mock }).openLinkText =
			openLinkText;
		const plugin = {
			app,
			settings: {
				singleClickAction: "edit",
				doubleClickAction: "openNote",
			},
			openTaskEditModal: jest.fn(),
		} as unknown as TaskNotesPlugin;
		const event = new MouseEvent("click", { button: 0 });

		await handleCalendarTaskClick(task, plugin, event, "calendar-event");
		await handleCalendarTaskClick(task, plugin, event, "calendar-event");

		expect(openLinkText).toHaveBeenCalledTimes(1);
		expect(openLinkText).toHaveBeenCalledWith(task.path, "", true);
		expect(plugin.openTaskEditModal).not.toHaveBeenCalled();
	});
});
