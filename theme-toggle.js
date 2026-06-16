(() => {
	const root = document.documentElement;
	const toggle = document.querySelector(".theme-toggle");
	const label = document.querySelector(".theme-toggle__label");

	if (!toggle || !label) return;

	const applyTheme = (theme) => {
		root.dataset.theme = theme;
		localStorage.setItem("theme", theme);
		const isLight = theme === "light";
		toggle.setAttribute("aria-pressed", String(isLight));
		label.textContent = isLight ? "Licht" : "Donker";
	};

	applyTheme(root.dataset.theme === "light" ? "light" : "dark");

	toggle.addEventListener("click", () => {
		applyTheme(root.dataset.theme === "light" ? "dark" : "light");
	});
})();
