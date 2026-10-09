// budget.mjs – Budjetti- ja Valtioneuvosto-sivujen sisältö. Luvut on poimittu valtioneuvoston ja VM:n tiedotteista.
// TARKISTA luvut lähteistä ennen julkaisua. Lisää uusia rivejä vain, kun lähde on julkaistu.
export const SRC = {
  vn: { label: "Valtioneuvosto: Orpon hallitus – Talous kasvaa, ja hallitus vauhdittaa kasvua täsmätoimilla (tiedote 1.9.2026)", url: "https://valtioneuvosto.fi/-/orpon-hallitus-talous-kasvaa-ja-hallitus-vauhdittaa-kasvua-tasmatoimilla" },
  vm: { label: "Valtiovarainministeriö: ehdotus vuoden 2027 budjetiksi (tiedote 6.8.2026)", url: "https://vm.fi/-/valtiovarainministerio-on-julkistanut-ehdotuksen-vuoden-2027-budjetiksi" },
  edBudjetti: { label: "Eduskunta: Eduskunta päättää valtion talousarviosta", url: "https://www.eduskunta.fi/fi/eduskunta-ja-sen-toiminta/miten-eduskunta-toimii/eduskunta-paattaa-valtion-talousarviosta/budjetti" },
};

export const TIMELINE = [
  { d: "6.8.2026", t: "Valtiovarainministeriö julkaisee budjettiehdotuksen", n: "Menot 92,2 mrd €, alijäämä 12,9 mrd €.", s: "vm" },
  { d: "1.–2.9.2026", t: "Hallitus neuvottelee budjettiriihessä ja päättää talousarvioesityksestä", n: "Hallituksen oman tiedotteen mukaan alijäämä 12,4 mrd €.", s: "vn" },
  { d: "21.9.2026", t: "Talousarvioesitys annetaan eduskunnalle", n: "VM:n tiedotteen mukaan esitys julkaistaan 21. syyskuuta.", s: "vm" },
  { d: "Syksy 2026", t: "Oppositio jättää vaihtoehtonsa talousarvioaloitteina", n: "Viime vuonna puolueiden vaihtoehtobudjetit julkaistiin marraskuussa.", s: null },
  { d: "Joulukuu 2026", t: "Eduskunta hyväksyy valtion budjetin", n: "Päätös tehdään eduskunnan täysistunnossa.", s: "vm" },
];

// Hallituksen oma sanamuoto lyhennettynä. Jokaisella rivillä on lähde (vn = 1.9.2026 tiedote).
export const GOV = {
  kehys: [
    ["Valtion talousarvion alijäämä 2027", "12,4 mrd €", "Hallituksen tiedotteen mukaan alijäämää kasvattavat erityisesti velan korkomenot sekä puolustus ja turvallisuus."],
    ["Suorat menoleikkaukset 2027", "4,8 mrd €", "Hallitus kertoo pitävänsä kiinni sovituista säästöistä."],
    ["Kehysriihessä päätetyt säästöt 2027", "noin 390 milj. €", "Kehysriihen säästöjä noin 540 milj. € vuoteen 2030 mennessä."],
    ["Valtionhallinnon toimintamenosäästöt 2027", "noin 593 milj. €", "Sisältää 60 milj. € keväällä päätettyjä lisäsäästöjä ja 25 milj. € syksyllä 2025 päätetyn lisäsäästön."],
    ["Valtion T&K-rahoitus 2027", "noin 3,40 mrd €", "Noin 230 milj. € enemmän kuin 2026. Tavoite 1,2 % bkt:sta vuoteen 2030."],
    ["Investointiohjelman määrärahat 2027", "878 milj. €", "Investointiohjelma laajenee noin 0,2 mrd € noin 4,7 mrd €:oon."],
  ],
  tax: {
    up: [
      ["Haittaverot (tupakka- ja alkoholivero)", "yhteensä 50 milj. €", "Tupakkaveron asteittaiset korotukset ovat hallitusohjelmassa."],
      ["Veikkauksen yhteisöverovapauden poisto ja arpajaisverokannan nosto", "lisää verotuloja", "Tapahtuu rahapelijärjestelmän uudistuksen yhteydessä."],
      ["Valtion eläkerahastosta eläkemenojen kattamiseen tehtävä siirto", "kasvaa noin 100 milj. €", "Tämä on rahoitussiirto, ei vero."],
    ],
    down: [
      ["Työn verotus", "−230 milj. €", "Kohdistuu pääosin pieni- ja keskituloisille."],
      ["Yhteisöverokanta", "−2 prosenttiyksikköä, 18 %", "Tulee voimaan ensi vuoden alusta."],
      ["Elinkeinotoiminnan tappion vähennysaika", "10 → 25 vuotta", "Tuloverotuksen muutos."],
      ["Kotitalousvähennyksen korotus", "jatkuu 2027", "Voimaan takautuvasti 2026 alusta."],
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
    ["Ukrainan tuki (puolustusministeriön hallinnonala)", "+200 milj. €", "Lisäksi sisäministeriön hallinnonalalle 3 milj. € (tarkista tiedotteesta)."],
    ["Asuinrakennusten energiatehokkuusavustukset", "50 milj. €", "Hallituksen poimintalistasta."],
    ["Sosiaali- ja terveyspalvelujen määräaikaiset kehittämishankkeet", "40 milj. €", "Hyvinvointialueille, Helsingille ja HUS-yhtymälle."],
    ["Psykoterapiakoulutus (yliopistot)", "10 milj. €", "Kaksiportainen psykoterapiakoulutus."],
    ["Hyvinvointialueiden ja Helsingin määräaikaiset kehittämishankkeet (järjestöjen kanssa)", "25 milj. €", "Alueellinen sote-järjestötoiminta."],
    ["Rajavartiolaitos: miehittämättömät valvontajärjestelmät (UXV30)", "10 milj. €", "Hanke on lähes kokonaan EU:n rahoittama."],
  ],
};

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
  oppositio: PARTIES,
});
