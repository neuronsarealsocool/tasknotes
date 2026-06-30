import { App, Modal, Notice, Setting } from "obsidian";
import TaskNotesPlugin from "../main";
import { PriorityConfig } from "../types";
import { PriorityManager } from "../services/PriorityManager";
import { normalizeThemeColor } from "../utils/themeColors";
import { DEFAULT_PRIORITIES } from "../settings/defaults";

interface PriorityCreationModalResult {
	name: string;
	color: string;
}

class PriorityCreationModal extends Modal {
	private resolve: (value: PriorityCreationModalResult | null) => void;
	private nameInput: HTMLInputElement;
	private colorInput: HTMLInputElement;
	private colorPickerInput: HTMLInputElement;

	constructor(app: App) {
		super(app);
	}

	public show(): Promise<PriorityCreationModalResult | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName("Add custom priority").setHeading();

		new Setting(contentEl)
			.setName("Name")
			.setDesc("Shown in priority menus and task cards.")
			.addText((text) => {
				this.nameInput = text.inputEl;
				text.setPlaceholder("Waiting").onChange(() => {});
			});

		const colorSetting = new Setting(contentEl)
			.setName("Color")
			.setDesc("Use a hex color, CSS color, or Obsidian theme color.")
			.addText((text) => {
				this.colorInput = text.inputEl;
				text.setPlaceholder("Hex color")
					.setValue("#6366f1")
					.onChange((value) => this.syncPickerFromText(value));
			});
		colorSetting.controlEl.addClass("tasknotes-priority-color-control");
		this.colorPickerInput = colorSetting.controlEl.createEl("input");
		this.colorPickerInput.type = "color";
		this.colorPickerInput.value = "#6366f1";
		this.colorPickerInput.addEventListener("input", () => {
			this.colorInput.value = this.colorPickerInput.value;
		});

		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.resolve(null);
			this.close();
		});

		const confirmButton = buttonContainer.createEl("button", {
			text: "Add priority",
			cls: "mod-cta",
		});
		confirmButton.addEventListener("click", () => this.confirm());

		const submitOnEnter = (event: KeyboardEvent) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.confirm();
			}
		};
		this.nameInput.addEventListener("keydown", submitOnEnter);
		this.colorInput.addEventListener("keydown", submitOnEnter);

		window.setTimeout(() => {
			this.nameInput.focus();
			this.nameInput.select();
		}, 100);
	}

	private syncPickerFromText(value: string): void {
		const trimmedValue = value.trim();
		if (/^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
			this.colorPickerInput.value = trimmedValue;
		}
	}

	private confirm(): void {
		const name = this.nameInput.value.trim();
		if (!name) {
			new Notice("Priority name is required");
			return;
		}

		this.resolve({
			name,
			color: normalizeThemeColor(this.colorInput.value, "#6366f1"),
		});
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.resolve) {
			this.resolve(null);
		}
	}
}

class PriorityRemovalModal extends Modal {
	private resolve: (value: PriorityConfig | null) => void;
	private selectedPriorityValue: string;
	private readonly removablePriorities: PriorityConfig[];

	constructor(app: App, priorities: PriorityConfig[]) {
		super(app);
		this.removablePriorities = priorities;
		this.selectedPriorityValue = priorities[0]?.value ?? "";
	}

	public show(): Promise<PriorityConfig | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName("Remove custom priority").setHeading();

		new Setting(contentEl)
			.setName("Priority")
			.setDesc("Remove a priority you added from the priority menu.")
			.addDropdown((dropdown) => {
				this.removablePriorities.forEach((priority) => {
					dropdown.addOption(priority.value, priority.label || priority.value);
				});
				dropdown.setValue(this.selectedPriorityValue);
				dropdown.onChange((value) => {
					this.selectedPriorityValue = value;
				});
			});

		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.resolve(null);
			this.close();
		});

		const confirmButton = buttonContainer.createEl("button", {
			text: "Remove priority",
			cls: "mod-warning",
		});
		confirmButton.addEventListener("click", () => {
			const priority = this.removablePriorities.find(
				(candidate) => candidate.value === this.selectedPriorityValue
			);
			this.resolve(priority ?? null);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.resolve) {
			this.resolve(null);
		}
	}
}

function slugifyPriorityValue(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "custom-priority";
}

function makeUniquePriorityValue(name: string, existingPriorities: PriorityConfig[]): string {
	const existingValues = new Set(existingPriorities.map((priority) => priority.value));
	const baseValue = slugifyPriorityValue(name);
	let value = baseValue;
	let counter = 2;

	while (existingValues.has(value)) {
		value = `${baseValue}-${counter}`;
		counter++;
	}

	return value;
}

export async function createCustomPriorityFromMenu(
	plugin: TaskNotesPlugin
): Promise<PriorityConfig | null> {
	const result = await new PriorityCreationModal(plugin.app).show();
	if (!result) {
		return null;
	}

	plugin.settings.customPriorities = plugin.settings.customPriorities ?? [];
	const existingPriorities = plugin.settings.customPriorities;
	const priority: PriorityConfig = {
		id: PriorityManager.generatePriorityId(existingPriorities),
		value: makeUniquePriorityValue(result.name, existingPriorities),
		label: result.name,
		color: result.color,
		weight: PriorityManager.generatePriorityWeight(existingPriorities),
	};

	existingPriorities.push(priority);
	await plugin.saveSettings();
	plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
	new Notice(`Added priority: ${priority.label}`);

	return priority;
}

function getRemovableCustomPriorities(priorities: PriorityConfig[]): PriorityConfig[] {
	const defaultPriorityIds = new Set(DEFAULT_PRIORITIES.map((priority) => priority.id));
	const defaultPriorityValues = new Set(DEFAULT_PRIORITIES.map((priority) => priority.value));

	return priorities.filter(
		(priority) =>
			!defaultPriorityIds.has(priority.id) && !defaultPriorityValues.has(priority.value)
	);
}

export async function removeCustomPriorityFromMenu(
	plugin: TaskNotesPlugin
): Promise<PriorityConfig | null> {
	plugin.settings.customPriorities = plugin.settings.customPriorities ?? [];
	const removablePriorities = getRemovableCustomPriorities(plugin.settings.customPriorities);

	if (removablePriorities.length === 0) {
		new Notice("No custom priorities to remove");
		return null;
	}

	const priority = await new PriorityRemovalModal(plugin.app, removablePriorities).show();
	if (!priority) {
		return null;
	}

	plugin.settings.customPriorities = plugin.settings.customPriorities.filter(
		(candidate) => candidate.id !== priority.id
	);
	plugin.settings.customPriorities
		.sort((a, b) => a.weight - b.weight)
		.forEach((candidate, index) => {
			candidate.weight = index;
		});

	if (plugin.settings.defaultTaskPriority === priority.value) {
		plugin.settings.defaultTaskPriority = plugin.settings.customPriorities[0]?.value ?? "";
	}

	await plugin.saveSettings();
	plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
	new Notice(`Removed priority: ${priority.label}`);

	return priority;
}
