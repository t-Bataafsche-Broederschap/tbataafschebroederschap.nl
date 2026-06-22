window.positionProjectTooltip = (event, tooltip, container = tooltip?.parentElement) => {
	if (!event || !tooltip || !container) return;

	const containerBounds = container.getBoundingClientRect();
	const tooltipBounds = tooltip.getBoundingClientRect();
	const offset = 14;
	const padding = 8;
	let left = event.clientX - containerBounds.left + offset;
	let top = event.clientY - containerBounds.top - tooltipBounds.height - offset;

	if (left + tooltipBounds.width > containerBounds.width - padding) {
		left = containerBounds.width - tooltipBounds.width - padding;
	}
	if (left < padding) left = padding;
	if (top < padding) top = event.clientY - containerBounds.top + offset;
	if (top + tooltipBounds.height > containerBounds.height - padding) {
		top = Math.max(padding, containerBounds.height - tooltipBounds.height - padding);
	}

	tooltip.style.left = `${left}px`;
	tooltip.style.top = `${top}px`;
};

const hideProjectTooltips = () => {
	document.querySelectorAll(".project-tooltip, .country-tooltip").forEach((tooltip) => {
		if (tooltip.classList.contains("world-population-tooltip")) {
			tooltip.style.display = "none";
			tooltip.setAttribute("aria-hidden", "true");
		} else {
			tooltip.hidden = true;
		}
	});
};

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") hideProjectTooltips();
});
document.addEventListener("pointerdown", hideProjectTooltips);
document.addEventListener("change", hideProjectTooltips);
window.addEventListener("scroll", hideProjectTooltips, { passive: true });
