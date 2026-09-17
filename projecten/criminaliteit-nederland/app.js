let LONG_DATA = [
	{ year: 1948, total: 133255, per1000: 14, solved: 91760, suspects: null, clearance: 68.9, provisional: false },
	{ year: 1949, total: 105080, per1000: 11, solved: 70340, suspects: null, clearance: 66.9, provisional: false },
	{ year: 1950, total: 103135, per1000: 10, solved: 68635, suspects: null, clearance: 66.5, provisional: false },
	{ year: 1951, total: 124620, per1000: 12, solved: 83025, suspects: null, clearance: 66.6, provisional: false },
	{ year: 1952, total: 121400, per1000: 12, solved: 88205, suspects: 95945, clearance: 72.7, provisional: false },
	{ year: 1953, total: 114955, per1000: 11, solved: 85560, suspects: 95885, clearance: 74.4, provisional: false },
	{ year: 1954, total: 109580, per1000: 10, solved: 81760, suspects: 91995, clearance: 74.6, provisional: false },
	{ year: 1955, total: 110655, per1000: 10, solved: 80465, suspects: 90750, clearance: 72.7, provisional: false },
	{ year: 1956, total: 112805, per1000: 10, solved: 79330, suspects: 90765, clearance: 70.3, provisional: false },
	{ year: 1957, total: 126770, per1000: 12, solved: 84345, suspects: 96960, clearance: 66.5, provisional: false },
	{ year: 1958, total: 133215, per1000: 12, solved: 86340, suspects: 100265, clearance: 64.8, provisional: false },
	{ year: 1959, total: 134290, per1000: 12, solved: 88115, suspects: 103805, clearance: 65.6, provisional: false },
	{ year: 1960, total: 140735, per1000: 12, solved: 91490, suspects: 108380, clearance: 65.0, provisional: false },
	{ year: 1961, total: 145035, per1000: 13, solved: 93165, suspects: 110030, clearance: 64.2, provisional: false },
	{ year: 1962, total: 155780, per1000: 13, solved: 94490, suspects: 115910, clearance: 60.7, provisional: false },
	{ year: 1963, total: 159000, per1000: 13, solved: 96155, suspects: 116460, clearance: 60.5, provisional: false },
	{ year: 1964, total: 172965, per1000: 14, solved: 101260, suspects: 123965, clearance: 58.5, provisional: false },
	{ year: 1965, total: 181560, per1000: 15, solved: 105930, suspects: 125940, clearance: 58.3, provisional: false },
	{ year: 1966, total: 197675, per1000: 16, solved: 107020, suspects: 129445, clearance: 54.1, provisional: false },
	{ year: 1967, total: 210570, per1000: 17, solved: 112200, suspects: 136070, clearance: 53.3, provisional: false },
	{ year: 1968, total: 232055, per1000: 18, solved: 121435, suspects: 145975, clearance: 52.3, provisional: false },
	{ year: 1969, total: 256765, per1000: 20, solved: 126340, suspects: 152615, clearance: 49.2, provisional: false },
	{ year: 1970, total: 284700, per1000: 22, solved: 131040, suspects: 158335, clearance: 46.0, provisional: false },
	{ year: 1971, total: 329820, per1000: 25, solved: 138840, suspects: 171110, clearance: 42.1, provisional: false },
	{ year: 1972, total: 373865, per1000: 28, solved: 150960, suspects: 182840, clearance: 40.4, provisional: false },
	{ year: 1973, total: 416840, per1000: 31, solved: 160440, suspects: 188930, clearance: 38.5, provisional: false },
	{ year: 1974, total: 456590, per1000: 34, solved: 165480, suspects: 190525, clearance: 36.2, provisional: false },
	{ year: 1975, total: 486670, per1000: 36, solved: 179520, suspects: 206215, clearance: 36.9, provisional: false },
	{ year: 1976, total: 564025, per1000: 41, solved: 207840, suspects: 234045, clearance: 36.8, provisional: false },
	{ year: 1977, total: 590880, per1000: 43, solved: 213360, suspects: 250715, clearance: 36.1, provisional: false },
	{ year: 1978, total: 612370, per1000: 44, solved: 224040, suspects: 257280, clearance: 36.6, provisional: false },
	{ year: 1979, total: 668235, per1000: 48, solved: 239520, suspects: 273150, clearance: 35.8, provisional: false },
	{ year: 1980, total: 757405, per1000: 54, solved: 252120, suspects: 292120, clearance: 33.3, provisional: false },
	{ year: 1981, total: 872355, per1000: 61, solved: 281520, suspects: 320245, clearance: 32.3, provisional: false },
	{ year: 1982, total: 990535, per1000: 69, solved: 297480, suspects: 344145, clearance: 30.0, provisional: false },
	{ year: 1983, total: 1059290, per1000: 74, solved: 309255, suspects: 352740, clearance: 29.2, provisional: false },
	{ year: 1984, total: 1163500, per1000: 81, solved: 326985, suspects: 374130, clearance: 28.1, provisional: false },
	{ year: 1985, total: 1174245, per1000: 81, solved: 315340, suspects: 368415, clearance: 26.9, provisional: false },
	{ year: 1986, total: 1178540, per1000: 81, solved: 313325, suspects: 365145, clearance: 26.6, provisional: false },
	{ year: 1987, total: 1212920, per1000: 83, solved: 319910, suspects: 358625, clearance: 26.4, provisional: false },
	{ year: 1988, total: 1231185, per1000: 84, solved: 319335, suspects: 357385, clearance: 25.9, provisional: false },
	{ year: 1989, total: 1245150, per1000: 84, solved: 319790, suspects: 360045, clearance: 25.7, provisional: false },
	{ year: 1990, total: 1235480, per1000: 83, solved: 306700, suspects: 350360, clearance: 24.8, provisional: false },
	{ year: 1991, total: 1268785, per1000: 85, solved: 285715, suspects: 344235, clearance: 22.5, provisional: false },
	{ year: 1992, total: 1362250, per1000: 90, solved: 290965, suspects: 350465, clearance: 21.4, provisional: false },
	{ year: 1993, total: 1366550, per1000: 90, solved: 285245, suspects: 341665, clearance: 20.9, provisional: false },
	{ year: 1994, total: 1410595, per1000: 92, solved: 283585, suspects: 341875, clearance: 20.1, provisional: false },
	{ year: 1995, total: 1317130, per1000: 85, solved: 251925, suspects: 348190, clearance: 19.1, provisional: false },
	{ year: 1996, total: 1274155, per1000: 82, solved: 245670, suspects: 357890, clearance: 19.3, provisional: false },
	{ year: 1997, total: 1309610, per1000: 84, solved: 236440, suspects: 371785, clearance: 18.1, provisional: false },
	{ year: 1998, total: 1325725, per1000: 85, solved: 252440, suspects: 388975, clearance: 19.0, provisional: false },
	{ year: 1999, total: 1399855, per1000: 89, solved: 252280, suspects: 393685, clearance: 18.0, provisional: false },
	{ year: 2000, total: 1426710, per1000: 90, solved: 248125, suspects: 397565, clearance: 17.4, provisional: false },
	{ year: 2001, total: 1481500, per1000: 93, solved: 279720, suspects: 414445, clearance: 18.9, provisional: false },
	{ year: 2002, total: 1505135, per1000: 93, solved: 307180, suspects: 449640, clearance: 20.4, provisional: false },
	{ year: 2003, total: 1470760, per1000: 91, solved: 335980, suspects: 487305, clearance: 22.8, provisional: false },
	{ year: 2004, total: 1417040, per1000: 87, solved: 346555, suspects: 508880, clearance: 24.5, provisional: false },
	{ year: 2005, total: 1348285, per1000: 83, solved: 339160, suspects: 494360, clearance: 25.2, provisional: false },
	{ year: 2006, total: 1311770, per1000: 80, solved: 334315, suspects: 491445, clearance: 25.5, provisional: false },
	{ year: 2007, total: 1303835, per1000: 80, solved: 326235, suspects: 482095, clearance: 25.0, provisional: false },
	{ year: 2008, total: 1277775, per1000: 78, solved: 312460, suspects: 457730, clearance: 24.5, provisional: false },
	{ year: 2009, total: 1254480, per1000: 76, solved: 313180, suspects: 412615, clearance: 25.0, provisional: false },
	{ year: 2010, total: 1200825, per1000: 72, solved: 331305, suspects: 406510, clearance: 27.6, provisional: false },
	{ year: 2011, total: 1206565, per1000: 72, solved: 326680, suspects: 397790, clearance: 27.1, provisional: false },
	{ year: 2012, total: 1154950, per1000: 69, solved: 308410, suspects: 373480, clearance: 26.7, provisional: false },
	{ year: 2013, total: 1105565, per1000: 66, solved: 289665, suspects: 350395, clearance: 26.2, provisional: false },
	{ year: 2014, total: 1025630, per1000: 61, solved: 271355, suspects: 327320, clearance: 26.5, provisional: false },
	{ year: 2015, total: 978945, per1000: 58, solved: 248875, suspects: 301555, clearance: 25.4, provisional: false },
	{ year: 2016, total: 930325, per1000: 55, solved: 234100, suspects: 278930, clearance: 25.2, provisional: false },
	{ year: 2017, total: 832950, per1000: 49, solved: 217265, suspects: 257895, clearance: 26.1, provisional: false },
	{ year: 2018, total: 786420, per1000: 46, solved: 217870, suspects: 258820, clearance: 27.7, provisional: false },
	{ year: 2019, total: 821905, per1000: 48, solved: 231520, suspects: 275985, clearance: 28.2, provisional: false },
	{ year: 2020, total: 813150, per1000: 47, solved: 220070, suspects: 263520, clearance: 27.1, provisional: false },
	{ year: 2021, total: 758065, per1000: 43, solved: 208875, suspects: 244070, clearance: 27.6, provisional: false },
	{ year: 2022, total: 810550, per1000: 46, solved: 229685, suspects: 264175, clearance: 28.3, provisional: false },
	{ year: 2023, total: 816540, per1000: 46, solved: 227895, suspects: 259155, clearance: 27.9, provisional: false },
	{ year: 2024, total: 815940, per1000: 45, solved: 208120, suspects: 249505, clearance: 25.5, provisional: true },
	{ year: 2025, total: 816210, per1000: 45, solved: 180085, suspects: 252000, clearance: 22.1, provisional: true },
];
let TYPE_DATA = [
	{ year: 2010, wealth: 715600.0, violence: 115800.0, destruction: 158300.0, order: 27700.0, drugs: 18000.0, weapons: 6500.0 },
	{ year: 2011, wealth: 723200.0, violence: 114100.0, destruction: 155600.0, order: 26600.0, drugs: 17100.0, weapons: 7400.0 },
	{ year: 2012, wealth: 704300.0, violence: 110500.0, destruction: 139600.0, order: 22800.0, drugs: 17600.0, weapons: 7000.0 },
	{ year: 2013, wealth: 690600.0, violence: 103500.0, destruction: 123300.0, order: 17900.0, drugs: 17000.0, weapons: 6500.0 },
	{ year: 2014, wealth: 631500.0, violence: 98500.0, destruction: 115000.0, order: 20400.0, drugs: 16300.0, weapons: 5900.0 },
	{ year: 2015, wealth: 614100.0, violence: 92500.0, destruction: 106700.0, order: 16100.0, drugs: 14800.0, weapons: 5500.0 },
	{ year: 2016, wealth: 576400.0, violence: 90200.0, destruction: 99300.0, order: 16200.0, drugs: 13300.0, weapons: 5400.0 },
	{ year: 2017, wealth: 502500.0, violence: 85300.0, destruction: 86200.0, order: 15900.0, drugs: 12500.0, weapons: 4700.0 },
	{ year: 2018, wealth: 457800.0, violence: 83300.0, destruction: 76700.0, order: 16700.0, drugs: 13400.0, weapons: 5500.0 },
	{ year: 2019, wealth: 473700.0, violence: 84000.0, destruction: 81700.0, order: 20700.0, drugs: 14700.0, weapons: 6600.0 },
	{ year: 2020, wealth: 471600.0, violence: 80200.0, destruction: 83400.0, order: 25600.0, drugs: 13300.0, weapons: 6800.0 },
	{ year: 2021, wealth: 419700.0, violence: 76400.0, destruction: 75800.0, order: 30500.0, drugs: 12200.0, weapons: 7000.0 },
	{ year: 2022, wealth: 448300.0, violence: 80600.0, destruction: 75100.0, order: 30900.0, drugs: 12200.0, weapons: 7100.0 },
	{ year: 2023, wealth: 464900.0, violence: 76200.0, destruction: 74100.0, order: 29500.0, drugs: 14300.0, weapons: 7000.0 },
	{ year: 2024, wealth: 464100.0, violence: 78000.0, destruction: 77300.0, order: 25200.0, drugs: 15300.0, weapons: 7300.0 },
	{ year: 2025, wealth: 451740.0, violence: 83345.0, destruction: 76940.0, order: 26590.0, drugs: 16115.0, weapons: 8005.0 },
];
let WEALTH_DATA = [
	{ year: 2010, wealth: 715600.0, theft: 670500.0, other: 45100.0 },
	{ year: 2011, wealth: 723200.0, theft: 678000.0, other: 45200.0 },
	{ year: 2012, wealth: 704300.0, theft: 656500.0, other: 47800.0 },
	{ year: 2013, wealth: 690600.0, theft: 650700.0, other: 40000.0 },
	{ year: 2014, wealth: 631500.0, theft: 592600.0, other: 38900.0 },
	{ year: 2015, wealth: 614100.0, theft: 549100.0, other: 64900.0 },
	{ year: 2016, wealth: 576400.0, theft: 498300.0, other: 78200.0 },
	{ year: 2017, wealth: 502500.0, theft: 428100.0, other: 74400.0 },
	{ year: 2018, wealth: 457800.0, theft: 380300.0, other: 77500.0 },
	{ year: 2019, wealth: 473700.0, theft: 374800.0, other: 98900.0 },
	{ year: 2020, wealth: 471600.0, theft: 330100.0, other: 141500.0 },
	{ year: 2021, wealth: 419700.0, theft: 287100.0, other: 132600.0 },
	{ year: 2022, wealth: 448300.0, theft: 349000.0, other: 99200.0 },
	{ year: 2023, wealth: 464900.0, theft: 364100.0, other: 100800.0 },
	{ year: 2024, wealth: 464100.0, theft: 358500.0, other: 105600.0 },
	{ year: 2025, wealth: 451740.0, theft: 354475.0, other: 97265.0 },
];
let VIOLENCE_DATA = [
	{ year: 2010, violence: 115800.0, assault: 61400.0, threat: 38100.0, sexual: 9700.0, other: 6600.0 },
	{ year: 2011, violence: 114100.0, assault: 60500.0, threat: 37700.0, sexual: 9100.0, other: 6700.0 },
	{ year: 2012, violence: 110500.0, assault: 57600.0, threat: 37300.0, sexual: 9100.0, other: 6500.0 },
	{ year: 2013, violence: 103500.0, assault: 53400.0, threat: 35800.0, sexual: 8600.0, other: 5700.0 },
	{ year: 2014, violence: 98500.0, assault: 50900.0, threat: 33900.0, sexual: 8200.0, other: 5500.0 },
	{ year: 2015, violence: 92500.0, assault: 48300.0, threat: 31100.0, sexual: 7700.0, other: 5400.0 },
	{ year: 2016, violence: 90200.0, assault: 47000.0, threat: 29700.0, sexual: 8200.0, other: 5300.0 },
	{ year: 2017, violence: 85300.0, assault: 44800.0, threat: 27000.0, sexual: 8400.0, other: 5100.0 },
	{ year: 2018, violence: 83300.0, assault: 43000.0, threat: 26100.0, sexual: 9100.0, other: 5100.0 },
	{ year: 2019, violence: 84000.0, assault: 42600.0, threat: 27400.0, sexual: 8300.0, other: 5600.0 },
	{ year: 2020, violence: 80200.0, assault: 38300.0, threat: 28800.0, sexual: 8100.0, other: 5100.0 },
	{ year: 2021, violence: 76400.0, assault: 36400.0, threat: 26000.0, sexual: 8800.0, other: 5200.0 },
	{ year: 2022, violence: 80600.0, assault: 41000.0, threat: 24400.0, sexual: 10100.0, other: 5100.0 },
	{ year: 2023, violence: 76200.0, assault: 39700.0, threat: 22400.0, sexual: 9300.0, other: 4800.0 },
	{ year: 2024, violence: 78000.0, assault: 40400.0, threat: 23000.0, sexual: 9900.0, other: 4800.0 },
	{ year: 2025, violence: 83345.0, assault: 42460.0, threat: 24705.0, sexual: 11120.0, other: 5060.0 },
];
let ONLINE_DATA = [
	{ year: 2012, cyber: 4500.0, fraud: 8500.0 },
	{ year: 2013, cyber: 2400.0, fraud: 6100.0 },
	{ year: 2014, cyber: 2000.0, fraud: 6000.0 },
	{ year: 2015, cyber: 2200.0, fraud: 39500.0 },
	{ year: 2016, cyber: 1800.0, fraud: 65500.0 },
	{ year: 2017, cyber: 2200.0, fraud: 62400.0 },
	{ year: 2018, cyber: 2800.0, fraud: 65300.0 },
	{ year: 2019, cyber: 4700.0, fraud: 84600.0 },
	{ year: 2020, cyber: 10800.0, fraud: 125400.0 },
	{ year: 2021, cyber: 14200.0, fraud: 117600.0 },
	{ year: 2022, cyber: 14000.0, fraud: 86800.0 },
	{ year: 2023, cyber: 12100.0, fraud: 88100.0 },
	{ year: 2024, cyber: 7000.0, fraud: 94300.0 },
];
let VICTIM_DATA = [
	{ year: 2010, total: 100.0, wealth: 100.0, destruction: 100.0 },
	{ year: 2011, total: 98.0, wealth: 103.1, destruction: 96.9 },
	{ year: 2012, total: 95.5, wealth: 102.4, destruction: 92.6 },
	{ year: 2013, total: 95.0, wealth: 106.4, destruction: 86.1 },
	{ year: 2014, total: 90.9, wealth: 100.8, destruction: 82.3 },
	{ year: 2015, total: 84.9, wealth: 94.5, destruction: 75.4 },
	{ year: 2016, total: 83.5, wealth: 89.2, destruction: 75.7 },
	{ year: 2017, total: 73.2, wealth: 77.5, destruction: 66.0 },
	{ year: 2019, total: 65.8, wealth: 66.8, destruction: 61.5 },
	{ year: 2021, total: 54.1, wealth: 51.8, destruction: 53.0 },
	{ year: 2023, total: 62.7, wealth: 62.3, destruction: 56.7 },
];
let COMPOSITION = [
	{ category: "Vermogensmisdrijven", y2010: 59.6, y2025: 55.3 },
	{ category: "Verkeersmisdrijven", y2010: 12.0, y2025: 17.1 },
	{ category: "Geweld en seksueel", y2010: 9.6, y2025: 10.2 },
	{ category: "Vernieling en brandstichting", y2010: 13.2, y2025: 9.4 },
	{ category: "Openbare orde en gezag", y2010: 2.3, y2025: 3.3 },
	{ category: "Drugsmisdrijven", y2010: 1.5, y2025: 2.0 },
	{ category: "(Vuur)wapenmisdrijven", y2010: 0.5, y2025: 1.0 },
	{ category: "Overige misdrijven", y2010: 1.3, y2025: 1.8 },
];

let MIGRATION_CHARTS = ["overviewChart", "overviewRateChart", "totalChart", "rateChart"];
let CBS_MIGRATION_TIMELINE = "https://www.cbs.nl/nl-nl/longread/diversen/2025/tijdlijn-migratie-1849-2025?onepage=true";
let TIMELINE_EVENTS = [
	{ year: 1948, label: "Migratie uit voormalig Nederlands-Indië (1945–1962)", detail: "Tussen 1945 en 1962 vestigden zich ongeveer 400.000 mensen uit voormalig Nederlands-Indië in Nederland; deze stroom begon vóór de grafiekreeks.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{ year: 1960, label: "Italiaanse en Spaanse arbeidsmigratie", detail: "De werving begon eind jaren vijftig; eerst kwamen vooral Italiaanse en Spaanse werknemers. 1960 is een beleidsmijlpaal, geen exact beginjaar.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{ year: 1964, label: "Turkse en Marokkaanse arbeidsmigratie (1964–1969)", detail: "Later in de jaren zestig volgden vooral Turkse en Marokkaanse werknemers; de wervingsakkoorden dateren uit 1964 en 1969.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{ year: 1973, label: "Wervingsstop", detail: "Nederland stopte de officiële werving uit mediterrane landen; migratie via gezinshereniging ging daarna door.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{
		year: 1975,
		label: "Surinaamse migratiepiek",
		detail: "De migratie uit Suriname liep al vanaf de jaren zestig op en bereikte rond de onafhankelijkheid in 1975 een piek van ongeveer 40.000 immigranten.",
		kind: "migration",
		charts: MIGRATION_CHARTS,
		sourceUrl: "https://www.cbs.nl/nl-nl/nieuws/2025/47/sinds-onafhankelijkheid-ruim-250-duizend-surinamers-naar-nederland-gekomen",
	},
	{ year: 1991, label: "Asielmigratie in de jaren negentig", detail: "Na het uitbreken van de oorlogen in voormalig Joegoslavië kwamen grotere groepen uit die regio en Somalië; later volgden vooral mensen uit Irak en Afghanistan.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{ year: 2002, label: "Piek 2001–2002", detail: "In 2001 en 2002 bereikte de reeks 93 geregistreerde misdrijven per 1.000 inwoners; het absolute maximum lag in 2002.", kind: "trend" },
	{ year: 2004, label: "Midden- en Oost-Europese arbeidsmigratie", detail: "Na de EU-uitbreiding van 2004 nam vooral de immigratie uit Polen sterk toe; vanaf 2007 groeide ook de instroom uit Bulgarije en Roemenië.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{ year: 2010, label: "Trendbreuk registratie", detail: "Vanaf 2010 kwamen de gegevens uit een nieuwere landelijke politiewaarneming; CBS meldt een lichte trendbreuk met eerdere jaren.", kind: "method" },
	{ year: 2014, label: "Syrische vluchtelingen", detail: "Vanaf 2014 kwamen steeds meer vluchtelingen uit Syrië naar Nederland; de eerste immigratiepiek volgde in 2016.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{ year: 2015, label: "Internetoplichting meegeteld", detail: "Sinds juni 2015 telt CBS ook misdrijven mee die bij het Landelijk Meldpunt Internet Oplichting zijn gemeld.", kind: "method", charts: ["onlineChart"] },
	{ year: 2018, label: "Delicten apart geregistreerd", detail: "Sinds juli 2018 kunnen samenhangende delicten niet meer in één registratie; daarvoor telde alleen het zwaarste delict.", kind: "method" },
	{ year: 2020, label: "Corona en online aangifte", detail: "Corona veranderde het criminaliteitsbeeld. Vanaf 30 april kon WhatsAppfraude online worden aangegeven, wat de registraties mede beïnvloedde.", kind: "method" },
	{ year: 2022, label: "Oekraïense vluchtelingen", detail: "Na de Russische invasie kwamen in 2022 ongeveer 108.000 vluchtelingen uit Oekraïne naar Nederland onder tijdelijke bescherming.", kind: "migration", charts: MIGRATION_CHARTS, sourceUrl: CBS_MIGRATION_TIMELINE },
	{ year: 2024, label: "Wet seksuele misdrijven", detail: "Sinds 1 juli 2024 zijn meer vormen van seksueel grensoverschrijdend gedrag strafbaar; dit verandert de reikwijdte van de registratie.", kind: "method", charts: ["violenceChart"] },
];

const dashboard = document.querySelector(".crime-dashboard");
const nf = new Intl.NumberFormat("nl-NL");
const pf = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });
const state = {
	tab: "overview",
	startYear: 1948,
	longScale: "linear",
	typeMode: "index",
	showEvents: true,
	selectedTypes: new Set(["wealth", "violence", "destruction", "order", "drugs", "weapons"]),
};
const typeMeta = {
	wealth: { label: "Vermogensmisdrijven", color: 1 },
	violence: { label: "Geweld en seksueel", color: 2 },
	destruction: { label: "Vernieling en brandstichting", color: 3 },
	order: { label: "Openbare orde en gezag", color: 4 },
	drugs: { label: "Drugsmisdrijven", color: 5 },
	weapons: { label: "(Vuur)wapenmisdrijven", color: 6 },
};
const color = (n) => getComputedStyle(dashboard).getPropertyValue(`--series-${n}`).trim();
const css = (name) => getComputedStyle(dashboard).getPropertyValue(name).trim();
const eventKindMeta = {
	migration: { label: "Migratiecontext", color: () => color(6) },
	trend: { label: "Trend in de reeks", color: () => color(3) },
	method: { label: "Registratie / wetgeving", color: () => color(4) },
	context: { label: "Maatschappelijke context", color: () => css("--muted") },
};
const formatValue = (v, kind = "number") => {
	if (v == null || Number.isNaN(v)) return "–";
	if (kind === "percent") return `${pf.format(v)}%`;
	if (kind === "index") return pf.format(v);
	return nf.format(Math.round(v));
};
function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
}
function pathFor(data, key, x, y, transform) {
	let d = "",
		open = false;
	data.forEach((row, i) => {
		let v = row[key];
		if (v == null || Number.isNaN(v)) {
			open = false;
			return;
		}
		if (transform) v = transform(v);
		const cmd = open ? "L" : "M";
		d += `${cmd}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
		open = true;
	});
	return d.trim();
}
function niceTicks(min, max, count = 5) {
	if (min === max) return [min];
	const raw = (max - min) / count;
	const pow = 10 ** Math.floor(Math.log10(raw));
	const ratio = raw / pow;
	const step = (ratio >= 5 ? 10 : ratio >= 2 ? 5 : ratio >= 1 ? 2 : 1) * pow;
	const start = Math.floor(min / step) * step;
	const out = [];
	for (let v = start; v <= max + step * 0.5; v += step) out.push(v);
	return out;
}
function renderLineChart(id, data, series, options = {}) {
	const host = document.getElementById(id);
	if (!host) return;
	host.innerHTML = "";
	const tooltip = document.createElement("div");
	tooltip.className = "chart-tooltip";
	host.appendChild(tooltip);

	const W = 960,
		H = 430,
		M = { l: 72, r: 24, t: state.showEvents ? 68 : 25, b: 52 },
		PW = W - M.l - M.r,
		PH = H - M.t - M.b;
	const values = [];
	for (const s of series)
		for (const row of data) {
			let v = row[s.key];
			if (v != null && Number.isFinite(v)) values.push(options.transform ? options.transform(v, s, row) : v);
		}
	let ymin = options.yMin ?? 0;
	let ymax = Math.max(...values, 1);
	if (options.scale === "log") {
		ymin = Math.max(1, Math.min(...values.filter((v) => v > 0)));
	} else if (options.zeroBaseline === false) {
		const vmin = Math.min(...values);
		const pad = (ymax - vmin) * 0.12 || ymax * 0.1;
		if (options.yMin == null) ymin = Math.max(0, vmin - pad);
		ymax += pad;
	} else {
		ymax *= 1.08;
	}
	const xKey = options.xKey || "year";
	const xValues = data.map((row, index) => Number(row[xKey] ?? index));
	const xMin = Math.min(...xValues);
	const xMax = Math.max(...xValues);
	const x = (i) => M.l + (xMin === xMax ? PW / 2 : ((xValues[i] - xMin) / (xMax - xMin)) * PW);
	const y = (v) => {
		if (options.scale === "log") {
			const a = Math.log10(ymin),
				b = Math.log10(ymax);
			return M.t + PH - ((Math.log10(Math.max(v, ymin)) - a) / (b - a)) * PH;
		}
		return M.t + PH - ((v - ymin) / (ymax - ymin)) * PH;
	};
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", options.aria || "Lijngrafiek");
	const gridColor = css("--grid"),
		muted = css("--muted"),
		panel = css("--panel");

	let grid = "";
	const yticks = options.scale === "log" ? [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000].filter((v) => v >= ymin && v <= ymax) : niceTicks(ymin, ymax, 5);
	yticks.forEach((v) => {
		const yy = y(v);
		grid += `<line x1="${M.l}" y1="${yy}" x2="${W - M.r}" y2="${yy}" stroke="${gridColor}" stroke-width="1"/>`;
		grid += `<text x="${M.l - 10}" y="${yy + 4}" fill="${muted}" font-size="12" text-anchor="end">${escapeHtml(options.yFormat ? options.yFormat(v) : compact(v))}</text>`;
	});
	const desiredTicks = Math.min(9, data.length);
	const used = new Set();
	for (let k = 0; k < desiredTicks; k++) {
		const i = Math.round((k * (data.length - 1)) / (desiredTicks - 1 || 1));
		if (used.has(i)) continue;
		used.add(i);
		const xx = x(i),
			label = data[i][xKey];
		grid += `<line x1="${xx}" y1="${M.t}" x2="${xx}" y2="${H - M.b}" stroke="${gridColor}" stroke-width=".6"/>`;
		grid += `<text x="${xx}" y="${H - 22}" fill="${muted}" font-size="12" text-anchor="middle">${escapeHtml(label)}</text>`;
	}
	svg.innerHTML = grid + `<rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" fill="transparent" stroke="${gridColor}" />`;

	const timelineEvents = state.showEvents ? TIMELINE_EVENTS.filter((event) => event.year >= xMin && event.year <= xMax && (!event.charts || event.charts.includes(id))) : [];
	const markerLevels = [];
	timelineEvents.forEach((event, index) => {
		const xx = M.l + (xMin === xMax ? PW / 2 : ((event.year - xMin) / (xMax - xMin)) * PW);
		const openLevel = markerLevels.findIndex((lastX) => xx - lastX >= 24);
		const level = openLevel === -1 ? markerLevels.length : openLevel;
		markerLevels[level] = xx;
		const markerY = M.t - 14 - level * 23;
		const eventColor = eventKindMeta[event.kind]?.color() || muted;
		svg.insertAdjacentHTML(
			"beforeend",
			`<g class="timeline-marker timeline-marker--${event.kind}" aria-label="${escapeHtml(`${event.year}: ${event.label}`)}">
				<line x1="${xx}" y1="${M.t}" x2="${xx}" y2="${H - M.b}" stroke="${eventColor}" stroke-width="1.25" stroke-dasharray="3 5" opacity=".7"/>
				<circle cx="${xx}" cy="${markerY}" r="10" fill="${panel}" stroke="${eventColor}" stroke-width="1.5"/>
				<text x="${xx}" y="${markerY + 4}" fill="${eventColor}" font-size="10" font-weight="700" text-anchor="middle">${index + 1}</text>
			</g>`
		);
	});

	series.forEach((s, si) => {
		const transform = options.transform ? (v) => options.transform(v, s) : null;
		const d = pathFor(data, s.key, x, y, transform);
		const c = s.color || color(si + 1);
		if (s.fill && data.length > 1 && d) {
			const first = data.findIndex((r) => r[s.key] != null),
				last = data.length - 1 - [...data].reverse().findIndex((r) => r[s.key] != null);
			const area = `${d} L${x(last)},${y(ymin)} L${x(first)},${y(ymin)} Z`;
			svg.insertAdjacentHTML("beforeend", `<path d="${area}" fill="${c}" opacity=".12"/>`);
		}
		svg.insertAdjacentHTML("beforeend", `<path d="${d}" fill="none" stroke="${c}" stroke-width="${s.width || 3}" stroke-linecap="round" stroke-linejoin="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`);
	});

	const focus = document.createElementNS("http://www.w3.org/2000/svg", "g");
	focus.style.display = "none";
	const focusLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
	focusLine.setAttribute("y1", M.t);
	focusLine.setAttribute("y2", H - M.b);
	focusLine.setAttribute("stroke", css("--muted"));
	focusLine.setAttribute("stroke-dasharray", "4 4");
	focus.appendChild(focusLine);
	const markers = series.map((s, si) => {
		const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		c.setAttribute("r", "5");
		c.setAttribute("fill", s.color || color(si + 1));
		c.setAttribute("stroke", panel);
		c.setAttribute("stroke-width", "2");
		focus.appendChild(c);
		return c;
	});
	svg.appendChild(focus);
	host.appendChild(svg);

	const legend = document.createElement("div");
	legend.className = "legend";
	series.forEach((s, si) => {
		legend.insertAdjacentHTML("beforeend", `<span class="legend-item"><span class="legend-swatch" style="background:${s.color || color(si + 1)}"></span>${escapeHtml(s.label)}</span>`);
	});
	host.appendChild(legend);
	if (timelineEvents.length) {
		const timelineLegend = document.createElement("div");
		timelineLegend.className = "timeline-legend";
		timelineLegend.setAttribute("aria-label", "Legenda gebeurtenissen");
		const kinds = [...new Set(timelineEvents.map((event) => event.kind))];
		timelineLegend.innerHTML = `<strong>Gebeurtenissen:</strong>${kinds.map((kind) => `<span><i style="border-color:${eventKindMeta[kind].color()}" aria-hidden="true"></i>${escapeHtml(eventKindMeta[kind].label)}</span>`).join("")}`;
		host.appendChild(timelineLegend);

		const timeline = document.createElement("details");
		timeline.className = "chart-timeline";
		timeline.innerHTML = `<summary>Tijdspunten in deze grafiek</summary><ol>${timelineEvents
			.map(
				(event, index) =>
					`<li><span class="timeline-number timeline-number--${event.kind}">${index + 1}</span><span><strong>${event.year} — ${escapeHtml(event.label)}</strong>${event.kind === "migration" ? '<span class="timeline-kind">Migratiecontext</span>' : ""}<small>${escapeHtml(event.detail)}${event.sourceUrl ? ` <a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">Bron</a>` : ""}</small></span></li>`
			)
			.join("")}</ol><p>Deze markeringen geven context en tonen geen bewezen oorzaak-gevolgrelatie.</p>`;
		host.appendChild(timeline);
	}

	svg.addEventListener("mousemove", (ev) => {
		const rect = svg.getBoundingClientRect();
		const sx = ((ev.clientX - rect.left) / rect.width) * W;
		const idx = xValues.reduce((best, _value, index) => (Math.abs(x(index) - sx) < Math.abs(x(best) - sx) ? index : best), 0);
		const row = data[idx],
			xx = x(idx);
		focus.style.display = "";
		focusLine.setAttribute("x1", xx);
		focusLine.setAttribute("x2", xx);
		let body = `<strong>${escapeHtml(row[xKey])}${row.provisional ? " *" : ""}</strong>`;
		series.forEach((s, si) => {
			let v = row[s.key];
			if (v == null) {
				markers[si].style.display = "none";
				return;
			}
			if (options.transform) v = options.transform(v, s, row);
			markers[si].style.display = "";
			markers[si].setAttribute("cx", xx);
			markers[si].setAttribute("cy", y(v));
			const seriesColor = s.color || color(si + 1);
			body += `<div class="tooltip-row"><span class="tooltip-label"><i class="tooltip-swatch" style="background:${seriesColor}" aria-hidden="true"></i>${escapeHtml(s.label)}</span><b>${escapeHtml(formatValue(v, s.kind || options.kind))}</b></div>`;
		});
		const eventsAtYear = timelineEvents.filter((event) => event.year === Number(row[xKey]));
		eventsAtYear.forEach((event) => {
			body += `<div class="tooltip-event"><strong>${escapeHtml(event.label)}</strong>${escapeHtml(event.detail)}</div>`;
		});
		tooltip.innerHTML = body;
		tooltip.style.display = "block";
		const localX = ev.clientX - rect.left,
			localY = ev.clientY - rect.top;
		tooltip.style.left = `${Math.min(rect.width - tooltip.offsetWidth - 8, Math.max(8, localX + 14))}px`;
		tooltip.style.top = `${Math.max(8, localY - tooltip.offsetHeight - 12)}px`;
	});
	svg.addEventListener("mouseleave", () => {
		focus.style.display = "none";
		tooltip.style.display = "none";
	});
}
function compact(v) {
	const av = Math.abs(v);
	if (av >= 1e6) return `${pf.format(v / 1e6)} mln`;
	if (av >= 1e3) return `${pf.format(v / 1e3)}k`;
	return pf.format(v);
}
function renderComposition() {
	const host = document.getElementById("compositionChart");
	host.innerHTML = "";
	COMPOSITION.forEach((r) => {
		host.insertAdjacentHTML(
			"beforeend",
			`
      <div class="composition-row">
        <div class="composition-name">${escapeHtml(r.category)}</div>
        <div class="bar-pair">
          <div class="bar-line"><span>2010</span><div class="track"><div class="fill y2010" style="width:${r.y2010}%"></div></div><b>${pf.format(r.y2010)}%</b></div>
          <div class="bar-line"><span>2025*</span><div class="track"><div class="fill y2025" style="width:${r.y2025}%"></div></div><b>${pf.format(r.y2025)}%</b></div>
        </div>
      </div>`
		);
	});
}
function renderMetrics() {
	const latest = LONG_DATA.at(-1),
		peak = LONG_DATA.reduce((a, b) => (b.total > a.total ? b : a));
	document.getElementById("metricTotal").textContent = nf.format(latest.total);
	document.getElementById("metricRate").textContent = nf.format(latest.per1000);
	document.getElementById("metricPeak").textContent = `${pf.format((latest.total / peak.total - 1) * 100)}%`;
	document.getElementById("metricClearance").textContent = `${pf.format(latest.clearance)}%`;
	document.getElementById("metricSuspects").textContent = nf.format(latest.suspects);
}
function renderLongTable() {
	const body = document.querySelector("#longTable tbody");
	body.innerHTML = [...LONG_DATA]
		.reverse()
		.map(
			(r) => `<tr>
    <td class="${r.provisional ? "provisional" : ""}">${r.year}${r.provisional ? "*" : ""}</td>
    <td>${nf.format(r.total)}</td><td>${nf.format(r.per1000)}</td>
    <td>${nf.format(r.solved)}</td><td>${r.suspects == null ? "–" : nf.format(r.suspects)}</td>
  </tr>`
		)
		.join("");
}
function indexData(data, keys) {
	const bases = {};
	keys.forEach((k) => (bases[k] = data.find((r) => r[k] != null)?.[k] || 1));
	return data.map((r) => {
		const out = { ...r };
		keys.forEach((k) => (out[k] = r[k] == null ? null : (r[k] / bases[k]) * 100));
		return out;
	});
}
function renderOverview() {
	renderLineChart("overviewChart", LONG_DATA, [{ key: "total", label: "Geregistreerde misdrijven", color: color(1), fill: true }], {
		zeroBaseline: true,
		aria: "Aantal geregistreerde misdrijven in Nederland van 1948 tot en met 2025",
	});
	const latest = LONG_DATA.at(-1);
	document.getElementById("overviewRateValue").textContent = `${nf.format(latest.per1000)} per 1.000`;
	renderLineChart("overviewRateChart", LONG_DATA, [{ key: "per1000", label: "Misdrijven per 1.000 inwoners", color: color(2), fill: true }], {
		zeroBaseline: false,
		yMin: 10,
		aria: "Geregistreerde misdrijven per duizend inwoners in Nederland van 1948 tot en met 2025",
	});
}
function renderLongTerm() {
	const d = LONG_DATA.filter((r) => r.year >= state.startYear);
	renderLineChart("totalChart", d, [{ key: "total", label: "Geregistreerde misdrijven", color: color(1), fill: true }], {
		scale: state.longScale,
		zeroBaseline: state.longScale !== "log",
		aria: "Langetermijntrend geregistreerde misdrijven",
	});
	renderLineChart("rateChart", d, [{ key: "per1000", label: "Per 1.000 inwoners", color: color(2) }], {
		zeroBaseline: false,
		kind: "number",
		aria: "Geregistreerde misdrijven per duizend inwoners",
	});
}
function renderTypes() {
	const keys = [...state.selectedTypes];
	let d = TYPE_DATA;
	if (state.typeMode === "index") d = indexData(TYPE_DATA, keys);
	const series = keys.map((k) => ({
		key: k,
		label: typeMeta[k].label,
		color: color(typeMeta[k].color),
		kind: state.typeMode === "index" ? "index" : "number",
	}));
	renderLineChart("typesChart", d, series, {
		zeroBaseline: state.typeMode !== "index",
		yMin: state.typeMode === "index" ? 40 : 0,
		kind: state.typeMode === "index" ? "index" : "number",
		aria: "Ontwikkeling van geregistreerde misdrijven per hoofdgroep",
	});
}
function renderWealth() {
	renderLineChart(
		"wealthChart",
		WEALTH_DATA,
		[
			{ key: "wealth", label: "Totaal vermogen", color: color(1), width: 4 },
			{ key: "theft", label: "Diefstal, verduistering en inbraak", color: color(2) },
			{ key: "other", label: "Overig", color: color(4) },
		],
		{ zeroBaseline: true, aria: "Geregistreerde vermogensmisdrijven" }
	);
	renderLineChart(
		"onlineChart",
		ONLINE_DATA,
		[
			{ key: "cyber", label: "Cybercrime", color: color(3) },
			{ key: "fraud", label: "Horizontale fraude", color: color(5) },
		],
		{ zeroBaseline: true, aria: "Geregistreerde cybercrime en horizontale fraude" }
	);
}
function renderViolence() {
	renderLineChart(
		"violenceChart",
		VIOLENCE_DATA,
		[
			{ key: "violence", label: "Totaal geweld en seksueel", color: color(1), width: 4 },
			{ key: "assault", label: "Mishandeling", color: color(2) },
			{ key: "threat", label: "Bedreiging en stalking", color: color(3) },
			{ key: "sexual", label: "Seksueel misdrijf", color: color(5) },
			{ key: "other", label: "Overig", color: color(6) },
		],
		{ zeroBaseline: true, aria: "Gewelds- en seksuele misdrijven vanaf 2010" }
	);
}
function renderChain() {
	renderLineChart("clearanceChart", LONG_DATA, [{ key: "clearance", label: "Ophelderingsratio", color: color(4), kind: "percent" }], {
		zeroBaseline: false,
		kind: "percent",
		yFormat: (v) => `${pf.format(v)}%`,
		aria: "Ophelderingsratio van geregistreerde misdrijven",
	});
	const d = LONG_DATA.filter((r) => r.suspects != null);
	renderLineChart("suspectsChart", d, [{ key: "suspects", label: "Verdachtenregistraties", color: color(3), fill: true }], {
		zeroBaseline: true,
		aria: "Registraties van verdachten vanaf 1952",
	});
}
function renderVictims() {
	renderLineChart(
		"victimChart",
		VICTIM_DATA,
		[
			{ key: "total", label: "Traditionele criminaliteit", color: color(1), kind: "index" },
			{ key: "wealth", label: "Vermogensdelicten", color: color(2), kind: "index" },
			{ key: "destruction", label: "Vernielingen", color: color(4), kind: "index" },
		],
		{ zeroBaseline: false, yMin: 45, kind: "index", aria: "Index van zelfgerapporteerd slachtofferschap" }
	);
}
function renderCurrent() {
	if (state.tab === "overview") renderOverview();
	if (state.tab === "longterm") renderLongTerm();
	if (state.tab === "types") renderTypes();
	if (state.tab === "wealth") renderWealth();
	if (state.tab === "violence") renderViolence();
	if (state.tab === "chain") renderChain();
	if (state.tab === "victims") renderVictims();
}
function setTab(name) {
	state.tab = name;
	dashboard.querySelectorAll(".tab").forEach((b) => {
		const selected = b.dataset.tab === name;
		b.setAttribute("aria-selected", String(selected));
		b.tabIndex = selected ? 0 : -1;
	});
	dashboard.querySelectorAll(".panel").forEach((p) => {
		const selected = p.id === name;
		p.classList.toggle("active", selected);
		p.hidden = !selected;
	});
	requestAnimationFrame(renderCurrent);
}
function activeDataset() {
	if (state.tab === "longterm") return LONG_DATA.filter((row) => row.year >= state.startYear);
	if (state.tab === "overview" || state.tab === "chain") return LONG_DATA;
	if (state.tab === "types") {
		const keys = [...state.selectedTypes];
		const rows = state.typeMode === "index" ? indexData(TYPE_DATA, keys) : TYPE_DATA;
		return rows.map((row) => Object.fromEntries(["year", ...keys].map((key) => [key, row[key]])));
	}
	if (state.tab === "wealth") return WEALTH_DATA.map((r, i) => ({ ...r, ...(ONLINE_DATA.find((o) => o.year === r.year) || {}) }));
	if (state.tab === "violence") return VIOLENCE_DATA;
	if (state.tab === "victims") return VICTIM_DATA;
	return COMPOSITION;
}
function downloadCSV() {
	const rows = activeDataset();
	const keys = [...new Set(rows.flatMap(Object.keys))];
	const csv = [
		keys.join(";"),
		...rows.map((r) =>
			keys
				.map((k) => {
					const v = r[k] ?? "";
					const text = String(v).replaceAll('"', '""');
					return /[;"\n]/.test(text) ? `"${text}"` : text;
				})
				.join(";")
		),
	].join("\n");
	const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = `criminaliteit-nederland-${state.tab}.csv`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function initControls() {
	const tabs = [...dashboard.querySelectorAll(".tab")];
	tabs.forEach((b, index) => {
		b.addEventListener("click", () => setTab(b.dataset.tab));
		b.addEventListener("keydown", (event) => {
			if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
			event.preventDefault();
			let next = index;
			if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
			if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
			if (event.key === "Home") next = 0;
			if (event.key === "End") next = tabs.length - 1;
			tabs[next].focus();
			setTab(tabs[next].dataset.tab);
		});
	});
	document.getElementById("csvBtn").addEventListener("click", downloadCSV);
	document.getElementById("printBtn").addEventListener("click", () => window.print());
	document.getElementById("eventsToggle").addEventListener("click", (event) => {
		state.showEvents = !state.showEvents;
		event.currentTarget.classList.toggle("active", state.showEvents);
		event.currentTarget.setAttribute("aria-pressed", String(state.showEvents));
		event.currentTarget.textContent = `Gebeurtenissen: ${state.showEvents ? "aan" : "uit"}`;
		renderCurrent();
	});
	document.getElementById("startYear").addEventListener("input", (e) => {
		state.startYear = Number(e.target.value);
		document.getElementById("startYearLabel").textContent = state.startYear;
		renderLongTerm();
	});
	dashboard.querySelectorAll("[data-scale]").forEach((b) =>
		b.addEventListener("click", () => {
			state.longScale = b.dataset.scale;
			dashboard.querySelectorAll("[data-scale]").forEach((x) => {
				x.classList.toggle("active", x === b);
				x.setAttribute("aria-pressed", String(x === b));
			});
			renderLongTerm();
		})
	);
	dashboard.querySelectorAll("[data-type-mode]").forEach((b) =>
		b.addEventListener("click", () => {
			state.typeMode = b.dataset.typeMode;
			dashboard.querySelectorAll("[data-type-mode]").forEach((x) => {
				x.classList.toggle("active", x === b);
				x.setAttribute("aria-pressed", String(x === b));
			});
			renderTypes();
		})
	);
	const checks = document.getElementById("typeChecks");
	Object.entries(typeMeta).forEach(([key, m]) => {
		const id = `type-${key}`;
		checks.insertAdjacentHTML("beforeend", `<label for="${id}"><input id="${id}" type="checkbox" value="${key}" checked>${escapeHtml(m.label)}</label>`);
	});
	checks.addEventListener("change", (e) => {
		if (!e.target.matches("input")) return;
		if (e.target.checked) state.selectedTypes.add(e.target.value);
		else state.selectedTypes.delete(e.target.value);
		if (!state.selectedTypes.size) {
			e.target.checked = true;
			state.selectedTypes.add(e.target.value);
		}
		renderTypes();
	});
}
renderMetrics();
renderComposition();
renderLongTable();
initControls();
renderOverview();
window.addEventListener("resize", () => renderCurrent(), { passive: true });

async function loadCanonicalData() {
	const response = await fetch("/api/v1/projecten/criminaliteit-nederland/data.json", { headers: { Accept: "application/json" } });
	if (!response.ok) throw new Error(`criminaliteit-data antwoordde met HTTP ${response.status}`);
	const payload = await response.json();
	({ LONG_DATA, TYPE_DATA, WEALTH_DATA, VIOLENCE_DATA, ONLINE_DATA, VICTIM_DATA, COMPOSITION, MIGRATION_CHARTS, CBS_MIGRATION_TIMELINE, TIMELINE_EVENTS } = payload);
	renderMetrics();
	renderComposition();
	renderLongTable();
	renderOverview();
	renderCurrent();
}

loadCanonicalData().catch((error) => console.error(error));
