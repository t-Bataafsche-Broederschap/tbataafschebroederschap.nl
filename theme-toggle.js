(() => {
	const root = document.documentElement;
	const toggle = document.querySelector(".theme-toggle");

	if (!toggle) return;

	const applyTheme = (theme) => {
		root.dataset.theme = theme;
		localStorage.setItem("theme", theme);
		const isLight = theme === "light";
		toggle.setAttribute("aria-pressed", String(isLight));
		toggle.setAttribute("aria-label", isLight ? "Schakel naar donker thema" : "Schakel naar licht thema");
	};

	applyTheme(root.dataset.theme === "light" ? "light" : "dark");
	requestAnimationFrame(() => {
		toggle.classList.add("theme-toggle--ready");
	});

	toggle.addEventListener("click", () => {
		applyTheme(root.dataset.theme === "light" ? "dark" : "light");
	});
})();
