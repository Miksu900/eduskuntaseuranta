// budget.mjs – Budjetti- ja Valtioneuvosto-sivujen sisältö. Luvut on poimittu valtioneuvoston ja VM:n tiedotteista.
// TARKISTA luvut lähteistä ennen julkaisua. Lisää uusia rivejä vain, kun lähde on julkaistu.
export const SRC = {
  vn: { label: "Valtioneuvosto: Orpon hallitus – Talous kasvaa, ja hallitus vauhdittaa kasvua täsmätoimilla (tiedote 1.9.2026)", url: "https://valtioneuvosto.fi/-/orpon-hallitus-talous-kasvaa-ja-hallitus-vauhdittaa-kasvua-tasmatoimilla" },
  vm: { label: "Valtiovarainministeriö: ehdotus vuoden 2027 budjetiksi (tiedote 6.8.2026)", url: "https://vm.fi/-/valtiovarainministerio-on-julkistanut-ehdotuksen-vuoden-2027-budjetiksi" },
  edBudjetti: { label: "Eduskunta: Eduskunta päättää valtion talousarviosta", url: "https://www.eduskunta.fi/fi/eduskunta-ja-sen-toiminta/miten-eduskunta-toimii/eduskunta-paattaa-valtion-talousarviosta/budjetti" },
};

export const TIMELINE = [
  { d: "6.8.2026", t: "Valtiovarainministeriö julkaisee budjettiehdotuksen", n: "Menot 92,2 mrd €, alijäämä 12,9 mrd €.", s: "vm" },
  { d: "1.9.2026", t: "Hallitus julkistaa talousarvioesityksensä (tiedote)", n: "Hallituksen oman tiedotteen mukaan alijäämä 12,4 mrd €.", s: "vn" },
  { d: "21.9.2026", t: "Talousarvioesitys annetaan eduskunnalle", n: "VM:n tiedotteen mukaan esitys julkaistaan 21. syyskuuta.", s: "vm" },
  { d: "1.10.2026", t: "Valtioneuvosto raportoi EU:lle liiallisen alijäämän korjaamisesta", n: "Raportointi tehdään alustavassa talousarviosuunnitelmassa.", s: "vn" },
  { d: "Syksy 2026", t: "Oppositio jättää vaihtoehtonsa talousarvioaloitteina", n: "Viime vuonna puolueiden vaihtoehtobudjetit julkaistiin marraskuussa.", s: null },
  { d: "Joulukuu 2026", t: "Eduskunta hyväksyy valtion budjetin", n: "Päätös tehdään eduskunnan täysistunnossa.", s: "vm" },
];

// Hallituksen oma sanamuoto lyhennettynä. Jokaisella rivillä on lähde (vn = 1.9.2026 tiedote).
export const GOV = {
  kehys: [
    ["Valtion talousarvion alijäämä 2027", "12,4 mrd €", "Hallituksen tiedotteen mukaan alijäämää kasvattavat erityisesti velan korkomenot sekä puolustus ja turvallisuus."],
    ["Suorat menoleikkaukset 2027", "4,8 mrd €", "Hallitus kertoo pitävänsä kiinni sovituista säästöistä."],
    ["Velkaantumista taittavat päätökset 2027", "lähes 1 mrd €", "Hallituksen tiedotteen mukaan."],
    ["Rakentamiseen kohdistuvat panostukset", "100 milj. €", "Mainitaan tiedotteen johdannossa."],
    ["Kehysriihen säästöt vuoteen 2030 mennessä", "noin 540 milj. €", "Kevään kehysriihen päätökset."],
    ["Kehysriihessä päätetyt säästöt 2027", "noin 390 milj. €", "Kehysriihen säästöjä noin 540 milj. € vuoteen 2030 mennessä."],
    ["Valtionhallinnon toimintamenosäästöt 2027", "noin 593 milj. €", "Sisältää 60 milj. € keväällä päätettyjä lisäsäästöjä ja 25 milj. € syksyllä 2025 päätetyn lisäsäästön."],
    ["Valtion T&K-rahoitus 2027", "noin 3,40 mrd €", "Noin 230 milj. € enemmän kuin 2026. Tavoite 1,2 % bkt:sta vuoteen 2030."],
    ["Investointiohjelman määrärahat 2027", "878 milj. €", "Investointiohjelma laajenee noin 0,2 mrd € noin 4,7 mrd €:oon."],
  ],
  tax: {
    up: [
      ["Haittaverot (tupakka- ja alkoholivero)", "yhteensä 50 milj. €", "Tupakkaveron asteittaiset korotukset ovat hallitusohjelmassa, ja alkoholiveron indeksoinnista päätettiin puoliväliriihessä."],
      ["Veikkauksen yhteisöverovapauden poisto ja arpajaisverokannan nosto", "lisää verotuloja", "Tapahtuu rahapelijärjestelmän uudistuksen yhteydessä."],
      ["Valtion eläkerahastosta eläkemenojen kattamiseen tehtävä siirto", "kasvaa noin 100 milj. €", "Tämä on rahoitussiirto, ei vero."],
    ],
    down: [
      ["Työn verotus", "−230 milj. €", "Kohdistuu pääosin pieni- ja keskituloisille."],
      ["Yhteisöverokanta", "−2 prosenttiyksikköä, 18 %", "Tulee voimaan ensi vuoden alusta."],
      ["Elinkeinotoiminnan tappion vähennysaika", "10 → 25 vuotta", "Tuloverotuksen muutos."],
      ["Ansiotuloveroperusteiden indeksitarkistukset", "kaikilla tulotasoilla", "Hallituksen tiedotteen mukaan."],
      ["Lahjoitusvähennys", "laajennetaan ja kasvatetaan", "Hallituksen tiedotteen mukaan."],
      ["Yrittäjävähennys", "korotetaan", "Hallituksen tiedotteen mukaan."],
      ["Kotitalousvähennys", "kasvatetaan vuosille 2026 ja 2027", "Voimaan takautuvasti 2026 alusta."],
      ["Liikunta- ja kulttuuriseteli", "soveltamisalaa laajennetaan", "Verovapaan edun enimmäismäärää korotetaan vuodesta 2026 alkaen."],
      ["Matkakuluvähennyksen omavastuun korotus (verovuosi 2026)", "pienentää 2027 kassakertymää", "Hallituksen tiedotteen mukaan."],
      ["Työsuhdeoptioiden verotusajankohta", "siirretään", "Listaamattomien yhtiöiden osakkeiden osalta käyttöhetkestä kohde-etuuden luovutushetkeen."],
      ["Liikennepolttoaineiden hiilidioksidiveron osa ja ajoneuvoveron perusvero", "alennetaan", "Hallituksen tiedotteen mukaan."],
    ],
    notDone: [
      "Datakeskuksille suunnitellusta verotuesta luovutaan.",
      "Suunniteltua jäteveron laajennusta ei toteuteta.",
      "Kiinteistöveron uudistusta ei viedä eteenpäin tällä vaalikaudella.",
    ],
  },
  cuts: [
    ["Valtion tukeman asuntotuotannon korkotukilainojen hyväksymisvaltuus", "−365 milj. €", "Aiemmin syksyllä 2025 päätetty sopeutustoimi viedään budjettiin."],
    ["Valtionhallinnon toimintamenot", "−593 milj. €", "Katso Kehys ja säästöt -taulukko."],
  ],
  plus: [
    ["Puolustusministeriön hallinnonala", "+618 milj. €", "Verrattuna vuoden 2026 varsinaiseen talousarvioon. Lisäksi 1,3 mrd € tilausvaltuuksia materiaalihankintoihin."],
    ["Ukrainan tuki (puolustusministeriön hallinnonala)", "+200 milj. €", "Lisäksi sisäministeriön hallinnonalalle 3 milj. € Ukrainan kuljetuskustannuksiin ja hankintoihin."],
    ["Asuinrakennusten energiatehokkuusavustukset", "50 milj. €", "Hallituksen poimintalistasta."],
    ["Sosiaali- ja terveyspalvelujen määräaikaiset kehittämishankkeet", "40 milj. €", "Hyvinvointialueille, Helsingille ja HUS-yhtymälle."],
    ["Psykoterapiakoulutus (yliopistot)", "10 milj. €", "Kaksiportainen psykoterapiakoulutus."],
    ["Hyvinvointialueiden ja Helsingin määräaikaiset kehittämishankkeet (järjestöjen kanssa)", "25 milj. €", "Alueellinen sote-järjestötoiminta."],
    ["Rajavartiolaitos: miehittämättömät valvontajärjestelmät (UXV30)", "10 milj. €", "Hanke on lähes kokonaan EU:n rahoittama."],
    ["Lainkäyttöhenkilöstö: tuomioistuimet", "3 milj. €", "Lisämäärärahaa resurssien turvaamiseen. Syyttäjälaitokselle 1 milj. €."],
    ["Rikosseuraamuslaitos", "3,45 milj. €", "Täytäntöönpanoon; vankiterveydenhuoltoon lisäksi 227 000 €. Päivärahan vähimmäismäärään tehdään elinkustannusindeksiin perustuva inflaatiotarkistus."],
    ["Poliisi ja Maahanmuuttovirasto (palautusten tehostaminen)", "1 milj. € + 1 milj. €", "Hallituksen tiedotteen mukaan."],
    ["Turvakotitoiminta", "noin 2,68 milj. €", "Paikkamäärien kasvattamiseksi."],
    ["Lapsiin liittyvien rikosepäilyjen selvittäminen (sote-yksiköt)", "noin 2,7 milj. €", "Uusiin tehtäviin."],
    ["Metso-ohjelma (metsien monimuotoisuus)", "5 milj. €", "Joista 4 milj. € ympäristöministeriön ja 1 milj. € maa- ja metsätalousministeriön hallinnonalalle."],
    ["Taidetestaajien toiminta", "3,5 milj. €", "Lukuvuonna 2027–2028."],
    ["Hevostalouden siirtymävaiheen siltarahoitus", "4 milj. €", "Rahapeliuudistuksen siirtymisvuodeksi."],
    ["Kyläkauppatuki ja paikallisten yhteisöjen varautuminen (kylävara)", "0,2 milj. € + 1 milj. €", "Hallituksen tiedotteen mukaan."],

    ["Rikosseuraamuslaitos: vankimäärän kasvu", "1 milj. €", "Hallituksen poimintalistasta."],
    ["Sakkotulot", "noin +3,9 milj. €", "Arvioitu kasvu (tulo, ei meno)."],
    ["Asiakas- ja potilasturvallisuuskeskuksen kustannusten korvaus", "1,1 milj. €", "Valtion erilliskorvauksena Pohjanmaan hyvinvointialueelle."],
    ["UKK-instituutti", "yhteensä 0,8 milj. €", "Rahoitukseen."],
    ["Teollisuuden lupaprosessien etusijamenettely", "2 milj. €", "Kertaluonteisesti."],
    ["Saamelaisten psykososiaalisen tuen järjestäminen", "0,5 milj. €", "Hallituksen poimintalistasta."],
    ["Vaasan yliopisto ja Vaasan seutu", "1 milj. € + 1 milj. €", "Tutkimusinfrastruktuurin vahvistamiseen ja Vaasan seudun infrahankkeisiin."],
    ["Maantie 5640 (Niskakylä–Kattaalankylä) peruskorjaus", "1,5 milj. €", "Hallituksen poimintalistasta."],
    ["Sosiaalityön tutkimus (Suomen Akatemia)", "4 milj. €", "Tänä vuonna käyttämättä jääneitä varoja, osoitetaan vuoden 2026 lisätalousarviossa."],
    ["Sikarutto: villisikojen metsästyspalkkio", "500 euroon", "Korotetaan vuoden 2026 loppuun saakka. Vaikutuksia arvioidaan vuoden 2027 täydentävässä talousarviossa. Kokonaissummaa ei ilmoitettu."],
    ["Puolustusvoimien terveydenhuollon valmius ja varautuminen", "noin 67 milj. €", "Hyvinvointialueille, Helsingin kaupungille ja HUS-yhtymälle."],

  ],
};


// Valtion budjettitalouden tulot, menot ja tasapaino (mrd €). Lähde: valtioneuvoston tiedote 1.9.2026.
export const TABLE = {
  head: ["", "2026 TA + II LTA*", "2027 TAE"],
  rows: [
    ["Tulot (pois lukien nettolainanotto)", "78,3", "80,1"],
    ["Menot", "91,7", "92,5"],
    ["Tasapaino", "−13,4", "−12,4"],
  ],
  note: "* Vuoden 2026 tuloihin ei ole sisällytetty Valtion asuntorahaston lakkauttamisesta aiheutuvaa kertaluonteista noin 2,3 mrd euron tuloutusta, jolla ei ole vaikutusta velanottoon. Lyhenteet: TA = talousarvio, II LTA = toinen lisätalousarvio, TAE = talousarvioesitys.",
};

export const KEY2 = [
  ["Talousarvioesityksen loppusumma 2027", "92,5 mrd €", "0,8 mrd € enemmän kuin vuodelle 2026 on budjetoitu (toinen lisätalousarvio mukaan lukien)."],
  ["Alijäämä", "12,4 mrd €", "0,9 mrd € pienempi kuin vuodelle 2026 budjetoitu. Kevään julkisen talouden suunnitelmaan verrattuna alijäämä on pienentynyt 0,7 mrd €, ja verotuloarviot ovat kasvaneet 0,8 mrd €."],
  ["Valtionvelan korkomenot", "4,4 mrd €", "1,2 mrd € enemmän kuin tälle vuodelle on budjetoitu."],
  ["Muutos VM:n ehdotukseen (6.8.)", "menot +0,3 mrd €, alijäämä −0,5 mrd €", "Laskettu: VM:n ehdotus 92,2 mrd € menoja ja 12,9 mrd € alijäämää, hallituksen esitys 92,5 ja 12,4."],
];

export const WELL = {
  hyvinvointialueet: [
    ["Hyvinvointialueiden yleiskatteinen rahoitus", "noin 27,6 mrd €", "Noin 0,36 mrd € enemmän kuin 2026 varsinaisessa talousarviossa."],
    ["Vuoden 2027 indeksikorotus", "2,71 % (noin 718 milj. €)", "Selittää kasvun pääosin."],
    ["Sote-palvelutarpeen vuosikasvu", "noin 248 milj. €", "Vuodesta 2027 kasvusta huomioidaan vain 60 %, mikä vähentää rahoitusta noin 61 milj. €."],
    ["Vuoden 2025 tilinpäätösten jälkikäteistarkistus", "noin −395 milj. €", "Rahoituksen jälkikäteistarkistus."],
    ["Tehtävälainsäädännön ja asiakasmaksusäädösten muutokset", "noin −185 milj. €", "Suurin vähennys asiakasmaksujen muutoksista (−87,8 milj. €). Lisäyksinä mm. vammaispalvelulain muutos +6,1 milj. €."],
  ],
  kunnat: [
    ["Peruspalvelujen valtionosuus", "3,4 mrd €", "Noin 110 milj. € vähemmän kuin vuoden 2026 varsinaisessa talousarviossa."],
    ["Perustoimeentulotuen rahoitusosuuden kasvu", "noin −121 milj. €", "Alentaa valtionosuutta vuoteen 2026 verrattuna."],
    ["Valtion ja kuntien välisen kustannustenjaon tarkistus 2027", "noin −55 milj. €", "Vähentää valtionosuutta."],
    ["Peruspalvelujen valtionosuuden indeksikorotus 2027", "3,5 % (noin +114 milj. €)", "Kasvattaa valtion osuutta."],
    ["Indeksijarrun korotus (kevään kehysriihi)", "1 → 2,8 prosenttiyksikköä, noin −91 milj. €", "Vähentää valtionosuutta vuoden 2026 talousarvioon verrattuna."],
    ["Uudet ja laajenevat tehtävät", "noin +41 milj. €", "Joista noin 31 milj. € siirretään muilta momenteilta. Sisältää mm. kotoutumispalveluiden uudistuksen (+28 milj. €), työvoimapoliittisen avustuksen (+9,6 milj. €) ja kotoutumistuen takuuajan säätämisen kustannusten korvauksen (+7,3 milj. €)."],
    ["Hallituskauden päätösten kokonaisvaikutus kuntatalouteen 2027", "noin +50 milj. €", "Hallituksen mukaan päätökset vahvistavat kuntataloutta. Yhteisöverokannan alentamisen vaikutukset kompensoidaan kunnille muuttamalla yhteisöveron jako-osuutta."],
  ],
};


// Investointiohjelman liikennehankkeet (valtuus = sitoumusvaltuus, määräraha = vuoden 2027 raha). Lähde: valtioneuvoston tiedote 1.9.2026.
export const TRANSPORT = [
  ["Karjalan rata", "valtuus +59 milj. € (90 → 149 milj. €), määräraha 17 milj. €", ""],
  ["Valtatie 2, Humppila", "8 milj. €", ""],
  ["Valtatie 8, Bäckliden–Brännbacken", "valtuus 19 milj. €, määräraha 1 milj. €", ""],
  ["Valtatie 9, Ylämylly", "valtuus 49 milj. €", ""],
  ["Valtatie 9, Suonenjoen keskusta", "määräraha 7,3 milj. €", ""],
  ["Valtatie 13, Savitaipale–Lemi", "valtuus 14,5 milj. €, määräraha 1 milj. €", ""],
  ["Valtatie 19, Tepon risteys ja Penttilän silta", "6 milj. €", ""],
  ["Valtatie 22, Muhos", "4 milj. €", ""],
  ["Valtatie 23, Rantala–Lajunlahti (Heinävesi)", "määräraha 4,8 milj. €", ""],
  ["Kantatie 51, Kelan risteys", "määräraha 6 milj. €", ""],
  ["Maantie 506, Juua", "määräraha 1 milj. €", ""],
  ["Kupittaan joukkoliikennekansi", "valtuus 6,75 milj. €, määräraha 0,9 milj. €", ""],
  ["Helsingin juna- ja metroasemien peruskorjaus", "valtuus 14,3 milj. €, määräraha 8 milj. €", ""],
  ["Loviisan meriväylän syventäminen", "valtuus 18 milj. €, määräraha 6 milj. €", ""],
  ["Sotilaallisen liikkuvuuden hankkeiden suunnittelu", "määräraha 7,04 milj. €", ""],
  ["Eurooppalaisen raideleveyden ratayhteyksien suunnittelu", "valtuus 46 milj. €, määräraha 0,5 milj. €", ""],
  ["Norvajärven varalaskupaikan kiertotie", "määräraha 3,6 milj. €", ""],
  ["Liikuntapaikkojen korjausvelan purku ja segregoituneiden alueiden liikuntamahdollisuudet", "15 milj. €", ""],
  ["Nousu- ja Helmi-ohjelmat (vaelluskalaesteiden poisto)", "lisäys 2 milj. €", ""],
];

export const PARTIES = [
  { k: "sd", n: "SDP", links: [
    { t: "Laskelmia SDP:n vaihtoehtobudjetin reformeista (marraskuu 2025, budjetti 2026)", u: "https://www.sdp.fi/app/uploads/sites/2/2025/11/sdp_vb_tah20250569a.pdf" },
  ] },
  { k: "kesk", n: "Keskusta", links: [
    { t: "Parempi vaihtoehto – uusi suunta Suomelle (marraskuu 2025, budjetti 2026)", u: "https://keskusta.fi/wp-content/uploads/2025/11/Keskusta-Parempi-vaihtoehto-uusi-suunta-Suomelle-2025.pdf" },
  ] },
  { k: "vihr", n: "Vihreät", links: [
    { t: "Vaihtoehtobudjetti 2024 (24.11.2023, vanha)", u: "https://www.vihreat.fi/vaihtoehtobudjetti-2024/" },
    { t: "Eduskuntavaalit 2027", u: "https://www.vihreat.fi/eduskuntavaalit-2027/" },
  ] },
  { k: "vas", n: "Vasemmistoliitto", links: [
    { t: "Vaihtoehtobudjetti 2024 (28.11.2023, vanha)", u: "https://vasemmisto.fi/wp-content/uploads/2023/11/Vaihtoehtobudjetti2024_OL2.pdf" },
  ] },
];

export const AI_FACTS = () => ({
  paivitetty: new Date().toISOString().slice(0, 10),
  lahteet: SRC,
  aikajana: TIMELINE,
  hallitus: GOV,
  taulukko: TABLE,
  liikennehankkeet: TRANSPORT,
  keskeiset: KEY2,
  hyvinvointialueet_ja_kunnat: WELL,
  oppositio: PARTIES,
});
