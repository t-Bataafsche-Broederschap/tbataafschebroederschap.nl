export const metricInfo = {
	population: {
		description: "Totale Nederlandse bevolking volgens CBS Bevolking; kerncijfers.",
		source: "CBS StatLine 85524NED; vanaf 1950 aangevuld met preciezere 85496NED.",
	},
	liveBirths: {
		description: "Levend geboren kinderen die tot de bevolking van Nederland behoren.",
		source: "CBS StatLine 85524NED; jaarlijkse kernreeks vanaf 1899.",
	},
	deaths: {
		description: "Overledenen binnen de bevolking van Nederland.",
		source: "CBS StatLine 85524NED; jaarlijkse kernreeks vanaf 1899.",
	},
	birthSurplus: {
		description: "Geboorteoverschot: levend geboren kinderen minus overledenen in hetzelfde jaar.",
		source: "CBS StatLine 85524NED; jaarlijkse kernreeks vanaf 1899.",
	},
	naturalGrowth: {
		description: "Natuurlijke groei, gelijk aan het geboorteoverschot: geboorten minus sterfte.",
		source: "CBS StatLine 85524NED.",
	},
	populationGrowth: {
		description: "Totale bevolkingsgroei in het kalenderjaar.",
		source: "CBS StatLine 85524NED; vanaf 1950 aangevuld met 85496NED.",
	},
	otherCorrections: {
		description: "Boekhoudkundige restpost: totale bevolkingsgroei minus geboorteoverschot en nettomigratie.",
		source: "Afgeleid uit CBS StatLine 85524NED, 85496NED en 85451NED.",
	},
	populationMinusNetMigration: {
		description:
			"Rekenkundige reeks: totale bevolking minus een gekalibreerde migratievoorraad. Vanaf 1972 sluit de lijn aan op de waargenomen of teruggeschatte bevolking geboren buiten Nederland; voor eerdere jaren gebruikt de pagina een op 1972 geankerde cumulatieve nettomigratie met niet-nul basisvoorraad. Dit is geen directe telling van 'inheemse Nederlanders'.",
		source: "Afgeleid uit CBS StatLine 85524NED, 85496NED, 85451NED, 70787NED, 70751NED en 85384NED.",
	},
	cumulativeImmigration: {
		description: "Som van alle jaarlijkse immigratie vanaf het eerste beschikbare CBS-jaar in deze reeks tot en met het geselecteerde jaar. Dit is geen nettomigratie en corrigeert niet voor latere emigratie of sterfte.",
		source: "Afgeleid uit CBS StatLine 85524NED; recente jaren aangevuld met 85451NED.",
	},
	cumulativeNetMigration: {
		description: "Som van alle jaarlijkse nettomigratie vanaf het eerste beschikbare CBS-jaar in deze reeks tot en met het geselecteerde jaar. Dit corrigeert wel voor emigratie, maar nog steeds niet voor geboorte, sterfte of samenstelling van groepen.",
		source: "Afgeleid uit CBS StatLine 85524NED; recente jaren aangevuld met 85451NED.",
	},
	bornAbroadPopulation: {
		description:
			"Bevolking die buiten Nederland is geboren. Vanaf 2022 direct uit CBS geboortelandtabellen; voor 1972-2021 in deze pagina teruggeschat uit 1e generatie migratieachtergrond plus een gekalibreerde kleine groep geboren buiten Nederland met twee in Nederland geboren ouders. De jaren 1972-1995 gebruiken de CBS-reconstructie uit 70787NED.",
		source: "CBS StatLine 85384NED vanaf 2022; oudere jaren in deze pagina afgeleid uit 70787NED, 70751NED en de 2022-2025 offset.",
	},
	bornAbroadPopulationPctPopulation: {
		description: "Aandeel van de bevolking dat buiten Nederland is geboren.",
		source: "Afgeleid uit CBS StatLine 85384NED, 70787NED, 70751NED en de totale bevolking.",
	},
	nativeBackgroundProxy: {
		description: "1972-1995: totale bevolking minus CBS-reconstructie migratieachtergrond. 1996-2021: CBS Nederlandse achtergrond. Vanaf 2022 doorgezet als publieke proxy via personen met twee in Nederland geboren ouders, ongeacht eigen geboorteland.",
		source: "CBS StatLine 70787NED voor 1972-1995, 70751NED voor 1996-2021; vanaf 2022 afgeleid uit 85384NED.",
	},
	nativeBackgroundProxyPctPopulation: {
		description: "Aandeel van de bevolking dat in deze grafiek onder Nederlandse achtergrond / twee in Nederland geboren ouders valt.",
		source: "Afgeleid uit CBS StatLine 70787NED, 70751NED, 85384NED en de totale bevolking.",
	},
	migrationBackgroundTotal: {
		description: "1972-1995: CBS-reconstructie migratieachtergrond. 1996-2021: CBS migratieachtergrond totaal. Vanaf 2022 afgeleid uit eigen geboorteland plus geboorteland van beide ouders. 3e generatie zit niet publiek in deze reeks.",
		source: "CBS StatLine 70787NED voor 1972-1995, 70751NED voor 1996-2021; vanaf 2022 afgeleid uit 85384NED.",
	},
	migrationBackgroundTotalPctPopulation: {
		description: "Aandeel van de bevolking met migratieachtergrond volgens de oude CBS-indeling of de recente reconstructie via geboorteland van persoon en ouders.",
		source: "Afgeleid uit CBS StatLine 70787NED, 70751NED, 85384NED en de totale bevolking.",
	},
	firstGenerationMigrationBackground: {
		description: "1972-1995: CBS-reconstructie 1e generatie migratieachtergrond. 1996-2021: CBS 1e generatie migratieachtergrond. Vanaf 2022 afgeleid als geboren buiten Nederland, minus geboren buiten Nederland met twee in Nederland geboren ouders.",
		source: "CBS StatLine 70787NED voor 1972-1995, 70751NED voor 1996-2021; vanaf 2022 afgeleid uit 85384NED.",
	},
	firstGenerationMigrationBackgroundPctPopulation: {
		description: "Aandeel van de bevolking dat in deze grafiek als 1e generatie migratieachtergrond wordt geteld.",
		source: "Afgeleid uit CBS StatLine 70787NED, 70751NED, 85384NED en de totale bevolking.",
	},
	secondGenerationMigrationBackground: {
		description: "1972-1995: CBS-reconstructie 2e generatie migratieachtergrond. 1996-2021: CBS 2e generatie migratieachtergrond. Vanaf 2022 afgeleid als geboren in Nederland met ten minste een buiten Nederland geboren ouder.",
		source: "CBS StatLine 70787NED voor 1972-1995, 70751NED voor 1996-2021; vanaf 2022 afgeleid uit 85384NED.",
	},
	secondGenerationMigrationBackgroundPctPopulation: {
		description: "Aandeel van de bevolking dat in deze grafiek als 2e generatie migratieachtergrond wordt geteld.",
		source: "Afgeleid uit CBS StatLine 70787NED, 70751NED, 85384NED en de totale bevolking.",
	},
	secondGenerationOneParentAbroad: {
		description: "Geboren in Nederland met een ouder geboren in Nederland en een ouder geboren buiten Nederland. Publiek beschikbaar vanaf 2022.",
		source: "CBS StatLine 85384NED.",
	},
	secondGenerationBothParentsAbroad: {
		description: "Geboren in Nederland met twee buiten Nederland geboren ouders. Publiek beschikbaar vanaf 2022.",
		source: "CBS StatLine 85384NED.",
	},
	bornAbroadDutchParents: {
		description: "Geboren buiten Nederland met twee in Nederland geboren ouders. Deze groep valt niet onder de oude CBS-definitie van 1e generatie migratieachtergrond, maar zit wel in de recente oudertabellen.",
		source: "CBS StatLine 85384NED.",
	},
	migrationPurposeEuTotal: {
		description: "EU/EFTA-immigranten totaal binnen de CBS-tabel naar afgeleid migratiedoel.",
		source: "CBS StatLine 84808ned.",
	},
	migrationPurposeEuWork: {
		description: "EU/EFTA-immigranten met afgeleid migratiedoel arbeid.",
		source: "CBS StatLine 84808ned.",
	},
	migrationPurposeEuFamily: {
		description: "EU/EFTA-immigranten met afgeleid migratiedoel gezin.",
		source: "CBS StatLine 84808ned.",
	},
	migrationPurposeEuStudy: {
		description: "EU/EFTA-immigranten met afgeleid migratiedoel studie.",
		source: "CBS StatLine 84808ned.",
	},
	migrationPurposeEuNoDerivedGoal: {
		description: "EU/EFTA-immigranten waarvoor CBS geen afgeleid migratiedoel publiceert.",
		source: "CBS StatLine 84808ned.",
	},
	migrationPurposeEuOther: {
		description: "EU/EFTA-immigranten met overig of onbekend afgeleid migratiedoel.",
		source: "CBS StatLine 84808ned.",
	},
	migrationPurposeNonEuTotal: {
		description: "Niet-EU/EFTA-immigranten totaal binnen de CBS-tabel naar migratiemotief op basis van IND-vergunning.",
		source: "CBS StatLine 84809NED.",
	},
	migrationPurposeNonEuWork: {
		description: "Niet-EU/EFTA-immigranten met migratiemotief arbeid.",
		source: "CBS StatLine 84809NED.",
	},
	migrationPurposeNonEuFamily: {
		description: "Niet-EU/EFTA-immigranten met migratiemotief gezin.",
		source: "CBS StatLine 84809NED.",
	},
	migrationPurposeNonEuAsylum: {
		description: "Niet-EU/EFTA-immigranten met migratiemotief asiel; nareizigers vallen in deze CBS-tabel ook onder asiel.",
		source: "CBS StatLine 84809NED.",
	},
	migrationPurposeNonEuStudy: {
		description: "Niet-EU/EFTA-immigranten met migratiemotief studie.",
		source: "CBS StatLine 84809NED.",
	},
	migrationPurposeNonEuTemporaryProtection: {
		description: "Niet-EU/EFTA-immigranten onder tijdelijke bescherming, zoals Oekraïense ontheemden vanaf 2022.",
		source: "CBS StatLine 84809NED.",
	},
	migrationPurposeNonEuOther: {
		description: "Niet-EU/EFTA-immigranten met overige migratiemotieven.",
		source: "CBS StatLine 84809NED.",
	},
	immigration: {
		description: "Personen die zich vanuit het buitenland in Nederland vestigen.",
		source: "CBS StatLine 85524NED; vanaf 2010 aangevuld met preciezere 85451NED.",
	},
	originImmigrationTotal: {
		description: "Totale immigratie binnen de CBS-tabellen die herkomst, geboorteland en nationaliteit uitsplitsen.",
		source: "CBS StatLine 85468NED en 85848NED, beschikbaar vanaf 2010.",
	},
	originDepartureEurope: {
		description: "Immigranten van wie het vorige woonland in Europa lag, exclusief Nederland.",
		source: "CBS StatLine 85671NED, beschikbaar vanaf 2014.",
	},
	originDepartureKnown: {
		description: "Immigranten waarvoor CBS een vertrekland buiten Nederland in de vertreklandindeling publiceert.",
		source: "CBS StatLine 85671NED, beschikbaar vanaf 2014.",
	},
	originDepartureOutsideEurope: {
		description: "Immigranten van wie het vorige woonland buiten Europa lag.",
		source: "CBS StatLine 85671NED, beschikbaar vanaf 2014.",
	},
	originBornNetherlands: {
		description: "Immigranten met geboorteland Nederland. Dit is de beste publieke CBS-proxy voor terugkomers/remigranten, maar geen perfecte terugkeerregistratie.",
		source: "CBS StatLine 85468NED.",
	},
	originBornOutsideNetherlands: {
		description: "Immigranten die buiten Nederland geboren zijn.",
		source: "CBS StatLine 85468NED.",
	},
	originDutchNationality: {
		description: "Immigranten met Nederlandse nationaliteit op het moment van immigratie.",
		source: "CBS StatLine 85848NED.",
	},
	originNonDutchNationality: {
		description: "Immigranten zonder Nederlandse nationaliteit op het moment van immigratie.",
		source: "CBS StatLine 85848NED.",
	},
	emigration: {
		description: "Emigratie inclusief administratieve correcties.",
		source: "CBS StatLine 85524NED; vanaf 2010 aangevuld met preciezere 85451NED.",
	},
	emigrationTotalDetailed: {
		description: "Totale emigratie binnen de CBS-tabellen die geboorteland en nationaliteit uitsplitsen, inclusief administratieve correcties.",
		source: "CBS StatLine 85468NED en 85848NED, beschikbaar vanaf 2010.",
	},
	emigrationDestinationReported: {
		description: "Gemelde emigratie naar een bestemmingsland, exclusief administratieve correcties. Dit is lager dan totale emigratie inclusief correcties.",
		source: "CBS StatLine 85671NED, beschikbaar vanaf 2014.",
	},
	emigrationDestinationKnown: {
		description: "Emigranten waarvoor CBS een bestemmingsland buiten Nederland publiceert. Exclusief administratieve correcties.",
		source: "CBS StatLine 85671NED, beschikbaar vanaf 2014.",
	},
	emigrationDestinationEurope: {
		description: "Gemelde emigratie met bestemmingsland in Europa, exclusief Nederland en exclusief administratieve correcties.",
		source: "CBS StatLine 85671NED, beschikbaar vanaf 2014.",
	},
	emigrationDestinationOutsideEurope: {
		description: "Gemelde emigratie met bestemmingsland buiten Europa, exclusief administratieve correcties.",
		source: "CBS StatLine 85671NED, beschikbaar vanaf 2014.",
	},
	emigrationBornNetherlands: {
		description: "Emigranten met geboorteland Nederland, inclusief administratieve correcties.",
		source: "CBS StatLine 85468NED.",
	},
	emigrationBornOutsideNetherlands: {
		description: "Emigranten met geboorteland buiten Nederland, inclusief administratieve correcties.",
		source: "CBS StatLine 85468NED.",
	},
	emigrationDutchNationality: {
		description: "Emigranten met Nederlandse nationaliteit op het moment van emigratie, inclusief administratieve correcties.",
		source: "CBS StatLine 85848NED.",
	},
	emigrationNonDutchNationality: {
		description: "Emigranten zonder Nederlandse nationaliteit op het moment van emigratie, inclusief administratieve correcties.",
		source: "CBS StatLine 85848NED.",
	},
	emigrationAdministrativeRemovals: {
		description: "Administratieve afvoeringen: personen die uit het bevolkingsregister zijn verwijderd omdat de verblijfplaats niet bekend is en zij waarschijnlijk niet meer in Nederland wonen.",
		source: "CBS StatLine 85468NED en 85848NED.",
	},
	netMigration: {
		description: "Immigratie minus emigratie, inclusief administratieve correcties.",
		source: "CBS StatLine 85524NED; vanaf 2010 aangevuld met preciezere 85451NED.",
	},
	netMigrationPctPopulation: {
		description: "Nettomigratie als percentage van de bevolking op 1 januari van hetzelfde jaar.",
		source: "Afgeleid uit nettomigratie en bevolking uit CBS StatLine 85524NED, 85496NED en 85451NED.",
	},
	newHomes: {
		description: "Nieuwbouwwoningen die in het kalenderjaar aan de woningvoorraad zijn toegevoegd.",
		source: "CBS StatLine 82235NED.",
	},
	netHousingStockGrowth: {
		description: "Saldo van de woningvoorraad na nieuwbouw, overige toevoegingen, onttrekkingen, sloop en correcties.",
		source: "CBS StatLine 82235NED.",
	},
	housingShortage: {
		description: "Statistisch woningtekort: geraamde spanning tussen huishoudensvraag en beschikbare woningvoorraad. Ontbrekende jaren tussen bekende bronpunten zijn lineair geinterpoleerd.",
		source: "ABF Research / Primos via overheidspublicaties.",
	},
	housingShortagePct: {
		description: "Woningtekort als percentage van de woningvoorraad. Ontbrekende jaren tussen bekende bronpunten zijn lineair geinterpoleerd.",
		source: "ABF Research / Primos via overheidspublicaties.",
	},
	housingStock: {
		description: "Eindstand van de Nederlandse woningvoorraad in het kalenderjaar.",
		source: "CBS StatLine 82235NED.",
	},
	personsPerHome: {
		description: "Aantal inwoners per woning in de woningvoorraad.",
		source: "Afgeleid uit CBS bevolking en woningvoorraad.",
	},
	populationGrowthPerNetHome: {
		description: "Bevolkingsgroei gedeeld door netto groei van de woningvoorraad in hetzelfde jaar.",
		source: "Afgeleid uit CBS bevolking en woningvoorraad.",
	},
	netHousingStockGrowthPer1000Residents: {
		description: "Netto woningvoorraadgroei per 1000 inwoners.",
		source: "Afgeleid uit CBS bevolking en woningvoorraad.",
	},
	gridAfnameRequests: {
		description: "Unieke grootverbruikverzoeken in de wachtrij voor afname van elektriciteit.",
		source: "Netbeheer Nederland.",
	},
	gridAfnameMw: {
		description: "Transportvermogen in MW in de wachtrij voor afname van elektriciteit.",
		source: "Netbeheer Nederland.",
	},
	gridInvoedingRequests: {
		description: "Unieke grootverbruikverzoeken in de wachtrij voor invoeding of teruglevering.",
		source: "Netbeheer Nederland.",
	},
	gridInvoedingMw: {
		description: "Transportvermogen in MW in de wachtrij voor invoeding of teruglevering.",
		source: "Netbeheer Nederland.",
	},
};

export const viewSourceNotes = {
	population: "CBS StatLine 85524NED vanaf 1899; deze tab combineert bevolking, samenstellingsvoorraden, aandelen en jaarstromen. Samenstellingsreeksen starten in 1972; 1972-1995 is CBS-reconstructie.",
	composition: "1972-1995 CBS-reconstructie migratieachtergrond; 1996-2021 CBS migratieachtergrond en generatie; vanaf 2022 gereconstrueerd via geboorteland van persoon en ouders.",
	growth: "Bevolkingsgroei wordt boekhoudkundig ontleed in geboorteoverschot, nettomigratie en overige correcties.",
	age: "Leeftijdsopbouw gebruikt CBS 70787NED, 37325 en 85384NED; ontbrekende buckets worden niet geinterpoleerd.",
	origin: "CBS StatLine 85671NED, 85468NED en 85848NED; definities verschillen.",
	emigration: "Bestemming: CBS 85671NED excl. administratieve correcties; overige reeksen incl. correcties.",
	motives: "CBS 84808ned gebruikt afgeleid migratiedoel voor EU/EFTA; CBS 84809NED gebruikt IND-migratiemotief voor niet-EU/EFTA.",
	housing: "CBS StatLine voor woningbouw; CBS/WBO/WoON en ABF/Primos voor woningtekort.",
	grid: "Netbeheer Nederland wachtrijreeksen.",
};

export const gridCardInfo = {
	afname: {
		title: "Afname",
		description: "Afname gaat over transportcapaciteit voor elektriciteitsverbruik door grootverbruikers. De wachtrij laat zien hoeveel gevraagd vermogen nog niet past.",
		source: "Netbeheer Nederland capaciteitskaart 2026.",
	},
	invoeding: {
		title: "Invoeding",
		description: "Invoeding gaat over transportcapaciteit voor teruglevering, bijvoorbeeld productie die het net op moet. De wachtrij is vermogen waarvoor nog geen ruimte is.",
		source: "Netbeheer Nederland capaciteitskaart 2026.",
	},
};
