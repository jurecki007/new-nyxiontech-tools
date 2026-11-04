// Copy for the static search pages, one per tool and language (/merge-pdf,
// /pl/polacz-pdf, ...). The build turns it into dist/<slug>.html (src/seo/pages.ts);
// the app never loads this file. Keep it accurate: describe what the tool really
// does (see src/utilities), and keep titles under 60 and descriptions under 155
// characters (the build fails otherwise).
import type { Lang, ToolId } from '../utilities/routes.ts';

export interface PageCopy {
  /** Short name for links and breadcrumbs, e.g. "Merge PDF". */
  name: string;
  /** <title>; the build fails above 60 characters. */
  title: string;
  /** Meta description; the build fails above 155 characters. */
  description: string;
  h1: string;
  /** Two or three short paragraphs. */
  intro: string[];
  /** How to use it, step by step. */
  steps: string[];
  /** Questions and answers specific to the tool (a privacy answer is added to every page). */
  faq: [question: string, answer: string][];
}

export interface ToolPage {
  /** Tools linked under "Related tools". */
  related: ToolId[];
  en: PageCopy;
  pl: PageCopy;
}

export const TOOL_PAGES: Record<ToolId, ToolPage> = {
  edit: {
    related: ['sign', 'fill-form', 'watermark', 'organize'],
    en: {
      name: 'Edit PDF',
      title: 'Edit PDF online free, no upload | Nyxiontech PDF Tools',
      description: 'Add text, white-out, highlights, boxes and images to a PDF in your browser. 21 fonts with Polish characters. Free, no sign-up, files never uploaded.',
      h1: 'Edit PDF: add text, white-out, highlights and images',
      intro: [
        'Open a PDF and write on it: add text in 21 embedded fonts, cover content with white-out, highlight, draw boxes and insert images, stamps or a logo (PNG, JPEG, WebP, GIF or SVG). You can also reorder, rotate, duplicate and delete pages, with undo and redo.',
        'Existing text cannot be retyped in place. To change it, cover it with white-out and type the new text on top. Arimo, Tinos and Cousine have the same widths as Arial, Times and Courier, so additions blend in with most invoices and forms.',
      ],
      steps: [
        'Drop one or more PDFs (several files are merged into one document).',
        'Pick a tool in the sidebar (Text, White-out, Highlight, Box, Image) and click or drag on the page.',
        'Download: you get a new PDF with the original content untouched and your edits drawn on top.',
      ],
      faq: [
        ['Can I change the existing text in a PDF?', 'Not directly. Cover the old text with white-out and type the replacement over it. Pick a font with matching metrics (Arimo for Arial, Tinos for Times) so it looks the same.'],
        ['Is my work saved?', 'Yes. Documents are autosaved in your browser (IndexedDB) and appear under Recent documents on the dashboard. Nothing is stored on a server.'],
        ['Does it support Polish characters?', 'Yes. All 21 fonts include Polish characters and are embedded in the output as subsets, so the PDF looks the same everywhere.'],
      ],
    },
    pl: {
      name: 'Edytuj PDF',
      title: 'Edytuj PDF za darmo, bez wysyłania plików | Nyxiontech',
      description: 'Dodaj tekst, korektor, zakreślenia, ramki i obrazy do PDF w przeglądarce. 21 czcionek z polskimi znakami. Za darmo, bez konta, pliki zostają u Ciebie.',
      h1: 'Edytuj PDF: tekst, korektor, zakreślacz i obrazy',
      intro: [
        'Otwórz PDF i pisz po nim: dodawaj tekst w 21 osadzanych czcionkach, zakrywaj treść korektorem, zakreślaj, rysuj ramki i wstawiaj obrazy, pieczątki albo logo (PNG, JPEG, WebP, GIF lub SVG). Strony możesz też przestawiać, obracać, duplikować i usuwać, a każdą zmianę cofnąć.',
        'Istniejącego tekstu nie da się przepisać w miejscu. Żeby go zmienić, zakryj go korektorem i wpisz nowy tekst na wierzchu. Czcionki Arimo, Tinos i Cousine mają te same szerokości co Arial, Times i Courier, więc dopiski wyglądają jak oryginał na większości faktur i formularzy.',
      ],
      steps: [
        'Upuść jeden lub kilka plików PDF (kilka plików łączy się w jeden dokument).',
        'Wybierz narzędzie z panelu bocznego (tekst, korektor, zakreślacz, ramka, obraz) i kliknij lub przeciągnij na stronie.',
        'Pobierz nowy PDF: oryginalna treść zostaje nietknięta, a Twoje zmiany są narysowane na wierzchu.',
      ],
      faq: [
        ['Czy mogę zmienić istniejący tekst w PDF?', 'Nie bezpośrednio. Zakryj stary tekst korektorem i wpisz nowy na nim. Wybierz czcionkę o tych samych wymiarach (Arimo zamiast Arial, Tinos zamiast Times), a poprawka nie będzie się wyróżniać.'],
        ['Czy moja praca się zapisuje?', 'Tak. Dokumenty zapisują się automatycznie w przeglądarce (IndexedDB) i są widoczne w ostatnich dokumentach na pulpicie. Nic nie trafia na serwer.'],
        ['Czy działają polskie znaki?', 'Tak. Wszystkie 21 czcionek ma polskie znaki i jest osadzanych w pliku, więc PDF wygląda tak samo na każdym komputerze.'],
      ],
    },
  },

  sign: {
    related: ['edit', 'fill-form', 'protect', 'merge'],
    en: {
      name: 'Sign PDF',
      title: 'Sign PDF free, no upload | Nyxiontech PDF Tools',
      description: 'Draw, type or upload your signature and place it on a PDF. Scanned signatures get their white background removed. Free, runs in your browser.',
      h1: 'Sign a PDF: draw, type or upload your signature',
      intro: [
        'Add your signature to contracts, forms and invoices without printing them. Draw it with a mouse or touchpad, type your name in a handwriting font, or upload a photo or scan of your signature: the white paper around it is removed, so only the ink lands on the page.',
        'Place the signature anywhere, resize it and add a date or initials as text. Your last signature is remembered on your device for next time.',
      ],
      steps: [
        'Drop the PDF you need to sign; the signature dialog opens with the document.',
        'Draw, type or upload your signature, then click on the page to place it.',
        'Move and resize it, then download the signed PDF.',
      ],
      faq: [
        ['Is this a legally binding electronic signature?', 'It is a visual signature: an image of your handwriting on the page, like signing a printout. It is not a qualified electronic signature based on a certificate. Many everyday documents accept it; for those that require a qualified signature, use a certified service.'],
        ['Can I use a scan of my signature?', 'Yes. Upload a photo or scan; the white background is removed so the signature sits cleanly on the document.'],
        ['Where is my signature stored?', 'Only in your browser on this device, so you can reuse it. It is never sent anywhere.'],
      ],
    },
    pl: {
      name: 'Podpisz PDF',
      title: 'Podpisz PDF online za darmo, bez wysyłania | Nyxiontech',
      description: 'Narysuj, wpisz lub wgraj podpis i umieść go na PDF. Ze skanu podpisu usuwamy białe tło. Za darmo, w przeglądarce, bez wysyłania plików.',
      h1: 'Podpisz PDF: narysuj, wpisz lub wgraj podpis',
      intro: [
        'Podpisuj umowy, wnioski i faktury bez drukowania. Narysuj podpis myszką lub touchpadem, wpisz imię i nazwisko odręczną czcionką albo wgraj zdjęcie lub skan podpisu: białe tło kartki zostanie usunięte, więc na stronę trafia sam podpis.',
        'Podpis możesz umieścić w dowolnym miejscu i zmienić jego rozmiar, a obok dopisać datę lub parafkę. Ostatni podpis jest zapamiętywany na Twoim urządzeniu.',
      ],
      steps: [
        'Upuść PDF do podpisania; okno podpisu otworzy się razem z dokumentem.',
        'Narysuj, wpisz lub wgraj podpis, a potem kliknij na stronie, żeby go umieścić.',
        'Przesuń go i dopasuj rozmiar, a następnie pobierz podpisany PDF.',
      ],
      faq: [
        ['Czy to podpis kwalifikowany?', 'Nie. To podpis odręczny w formie obrazu, tak jak podpis na wydruku. Nie zastępuje podpisu kwalifikowanego ani Profilu Zaufanego. W wielu codziennych sprawach wystarcza, ale tam, gdzie wymagany jest podpis kwalifikowany, użyj certyfikowanej usługi.'],
        ['Czy mogę użyć skanu podpisu?', 'Tak. Wgraj zdjęcie lub skan; białe tło zostanie usunięte i podpis będzie czysto wyglądał na dokumencie.'],
        ['Gdzie jest przechowywany mój podpis?', 'Tylko w przeglądarce na tym urządzeniu, żeby można go było użyć ponownie. Nigdzie nie jest wysyłany.'],
      ],
    },
  },

  'fill-form': {
    related: ['sign', 'edit', 'merge', 'protect'],
    en: {
      name: 'Fill PDF form',
      title: 'Fill PDF forms free, no upload | Nyxiontech PDF Tools',
      description: 'Fill in interactive PDF forms (text fields, checkboxes, lists) in your browser and optionally flatten them so answers cannot be changed. Free, private.',
      h1: 'Fill in a PDF form',
      intro: [
        'Applications, declarations and order forms often come as interactive PDFs. Open one here and every fillable field is listed: text boxes, checkboxes, radio buttons and drop-down lists. Type your answers and save a filled copy.',
        'Tick "Lock the answers (flatten)" to turn the fields into normal page text, so the recipient sees exactly what you entered and it cannot be edited. If a PDF has no fillable fields, use Edit PDF and type on the page instead.',
      ],
      steps: [
        'Drop the PDF form; its fields are read and listed.',
        'Fill in the values, and optionally choose to flatten the form.',
        'Save the filled form and download it, or open it in the editor to sign it.',
      ],
      faq: [
        ['My PDF has no fields. What can I do?', 'Then it is not an interactive form. Open it in Edit PDF and add text where needed; it ends up the same on paper.'],
        ['What does flattening do?', 'It turns the form fields into ordinary page content. The answers stay visible but can no longer be changed in a PDF reader.'],
        ['Can I sign the form too?', 'Yes. After filling it in, open the result in the editor and add your signature.'],
      ],
    },
    pl: {
      name: 'Wypełnij formularz PDF',
      title: 'Wypełnij formularz PDF za darmo | Nyxiontech',
      description: 'Wypełnij interaktywny formularz PDF (pola tekstowe, pola wyboru, listy) w przeglądarce i opcjonalnie zablokuj odpowiedzi. Za darmo, bez wysyłania.',
      h1: 'Wypełnij formularz PDF',
      intro: [
        'Wnioski, oświadczenia i zamówienia często przychodzą jako interaktywne pliki PDF. Otwórz taki plik, a zobaczysz listę wszystkich pól: tekstowych, pól wyboru, przycisków opcji i list rozwijanych. Wpisz odpowiedzi i zapisz wypełnioną kopię.',
        'Zaznacz „Lock the answers (flatten)”, aby zamienić pola w zwykły tekst na stronie: odbiorca zobaczy dokładnie to, co wpisałeś, i nie da się tego zmienić. Jeśli PDF nie ma pól do wypełnienia, użyj edytora i wpisz tekst bezpośrednio na stronie.',
      ],
      steps: [
        'Upuść formularz PDF; jego pola zostaną odczytane i wyświetlone.',
        'Wpisz wartości i w razie potrzeby wybierz spłaszczenie formularza.',
        'Zapisz i pobierz wypełniony formularz albo otwórz go w edytorze, żeby go podpisać.',
      ],
      faq: [
        ['Mój PDF nie ma pól. Co zrobić?', 'To znaczy, że nie jest to formularz interaktywny. Otwórz go w edytorze PDF i dopisz tekst w odpowiednich miejscach; po wydruku wygląda tak samo.'],
        ['Co daje spłaszczenie formularza?', 'Pola zamieniają się w zwykłą treść strony. Odpowiedzi są widoczne, ale nie da się ich już zmienić w czytniku PDF.'],
        ['Czy mogę też podpisać formularz?', 'Tak. Po wypełnieniu otwórz wynik w edytorze i dodaj podpis.'],
      ],
    },
  },

  'page-numbers': {
    related: ['watermark', 'merge', 'organize', 'edit'],
    en: {
      name: 'Add page numbers',
      title: 'Add page numbers to PDF free | Nyxiontech PDF Tools',
      description: 'Number PDF pages in your browser: six positions, formats like "Page 3 of 12", your own font, size and colour, start number and cover-page skip. Free.',
      h1: 'Add page numbers to a PDF',
      intro: [
        'Number every page of a report, thesis or contract in seconds. Choose one of six positions (top or bottom, left, centre or right), a format such as "3", "3 / 12" or "Page 3 of 12", or write your own using {n} for the page number and {total} for the page count.',
        'Set the font, size, colour and distance from the edge. Numbering can start at any number, and the first page (a cover) can be skipped.',
      ],
      steps: [
        'Drop a PDF.',
        'Pick the position and format, and adjust the font, size, margin and colour if needed.',
        'Click "Add page numbers" and download the numbered PDF.',
      ],
      faq: [
        ['Can I leave the cover page without a number?', 'Yes. Tick "Skip the first page (cover)"; numbering then continues from the second page.'],
        ['Can numbering start at a number other than 1?', 'Yes. Set "Start at" to any number, for example when the PDF is a chapter of a longer document.'],
        ['Is the original content changed?', 'No. The numbers are added on top of each page; the rest of the page stays as it was.'],
      ],
    },
    pl: {
      name: 'Numeracja stron',
      title: 'Numeracja stron PDF za darmo, bez wysyłania | Nyxiontech',
      description: 'Ponumeruj strony PDF w przeglądarce: sześć pozycji, formaty jak „Strona 3 z 12”, własna czcionka, rozmiar i kolor, pominięcie okładki. Za darmo.',
      h1: 'Dodaj numery stron do PDF',
      intro: [
        'Ponumeruj strony raportu, pracy dyplomowej czy umowy w kilka sekund. Wybierz jedną z sześciu pozycji (góra lub dół; lewa, środek lub prawa), format taki jak „3”, „3 / 12” czy „Strona 3 z 12” albo wpisz własny: {n} to numer strony, a {total} liczba stron.',
        'Ustaw czcionkę, rozmiar, kolor i odległość od krawędzi. Numerację możesz zacząć od dowolnej liczby i pominąć pierwszą stronę (okładkę).',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wybierz pozycję i format, a w razie potrzeby zmień czcionkę, rozmiar, margines i kolor.',
        'Kliknij „Add page numbers” i pobierz ponumerowany PDF.',
      ],
      faq: [
        ['Czy mogę pominąć okładkę?', 'Tak. Zaznacz „Skip the first page (cover)”; numeracja zacznie się od drugiej strony.'],
        ['Czy numeracja może zaczynać się od innej liczby niż 1?', 'Tak. Ustaw „Start at” na dowolną liczbę, na przykład gdy PDF to jeden rozdział dłuższego dokumentu.'],
        ['Czy treść dokumentu się zmienia?', 'Nie. Numery są dodawane na wierzchu strony, reszta pozostaje bez zmian.'],
      ],
    },
  },

  watermark: {
    related: ['page-numbers', 'protect', 'edit', 'compress'],
    en: {
      name: 'Watermark PDF',
      title: 'Watermark PDF free, no upload | Nyxiontech PDF Tools',
      description: 'Stamp COPY, DRAFT, CONFIDENTIAL or your own text across every PDF page: diagonal or horizontal, once or tiled, any font, colour and opacity. Free.',
      h1: 'Add a watermark to a PDF',
      intro: [
        'Mark a document as a copy, a draft or confidential before you send it. Type any text or pick a ready one (COPY, DRAFT, CONFIDENTIAL, PAID, KOPIA, ORYGINAŁ), then choose the font, size, colour and opacity.',
        'Place it once in the centre or tile it across the whole page, diagonally or horizontally. The watermark is added to every page.',
      ],
      steps: [
        'Drop a PDF.',
        'Enter the watermark text and set its look and layout.',
        'Click "Add watermark" and download the result.',
      ],
      faq: [
        ['Can I use my own text?', 'Yes. Type anything, including Polish characters, and choose from 21 fonts.'],
        ['Can the watermark be removed later?', 'It is drawn into the page content, so it cannot simply be switched off in a reader. Someone with a PDF editor could still cover or remove it, as with any watermark.'],
        ['Is the watermark on every page?', 'Yes, on every page of the document, in the same position.'],
      ],
    },
    pl: {
      name: 'Znak wodny PDF',
      title: 'Znak wodny w PDF za darmo, bez wysyłania | Nyxiontech',
      description: 'Dodaj KOPIA, ORYGINAŁ, DRAFT lub własny tekst na każdej stronie PDF: ukośnie lub poziomo, raz lub kafelkami, z wybraną czcionką i przezroczystością.',
      h1: 'Dodaj znak wodny do PDF',
      intro: [
        'Oznacz dokument jako kopię, wersję roboczą albo poufny, zanim go wyślesz. Wpisz dowolny tekst lub wybierz gotowy (KOPIA, ORYGINAŁ, COPY, DRAFT, CONFIDENTIAL, PAID), a potem ustaw czcionkę, rozmiar, kolor i przezroczystość.',
        'Znak wodny może pojawić się raz na środku albo powtarzać się na całej stronie, ukośnie lub poziomo. Jest dodawany na każdej stronie.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wpisz tekst znaku wodnego i ustaw jego wygląd oraz układ.',
        'Kliknij „Add watermark” i pobierz wynik.',
      ],
      faq: [
        ['Czy mogę wpisać własny tekst?', 'Tak, dowolny, także z polskimi znakami, w jednej z 21 czcionek.'],
        ['Czy znak wodny da się później usunąć?', 'Jest wrysowany w treść strony, więc nie da się go po prostu wyłączyć w czytniku. Ktoś z edytorem PDF mógłby go zakryć lub usunąć, jak każdy znak wodny.'],
        ['Czy znak wodny jest na każdej stronie?', 'Tak, na każdej stronie dokumentu, w tym samym miejscu.'],
      ],
    },
  },

  metadata: {
    related: ['redact', 'protect', 'edit', 'compress'],
    en: {
      name: 'Edit PDF metadata',
      title: 'Edit PDF metadata free, no upload | Nyxiontech PDF Tools',
      description: 'See and change a PDF’s title, author, subject, keywords, creator and producer, or wipe them before sharing. Free, in your browser, no upload.',
      h1: 'Edit or remove PDF metadata',
      intro: [
        'Every PDF carries hidden properties: title, author, subject, keywords, the application that created it and the software that wrote the file. They often reveal a name or a program you did not mean to share.',
        'Open a PDF to see these properties, change any of them, or clear them all with one click, and save a copy. The title is what browsers and PDF viewers show in the tab or title bar.',
      ],
      steps: [
        'Drop a PDF; its current properties are shown.',
        'Edit the fields, or click "Clear all fields".',
        'Click "Save metadata" and download the file.',
      ],
      faq: [
        ['Why remove metadata?', 'The author and creator fields can reveal your name, your company or the software you use. Clearing them before you share a document keeps that private.'],
        ['Does it change what is on the pages?', 'No. Only the document properties change; the pages stay the same.'],
        ['Why does the title matter?', 'Browsers and PDF readers show it instead of the file name, and search engines may use it for PDFs published online.'],
      ],
    },
    pl: {
      name: 'Edytuj metadane PDF',
      title: 'Edytuj metadane PDF (autor, tytuł) za darmo | Nyxiontech',
      description: 'Zobacz i zmień tytuł, autora, temat, słowa kluczowe i program twórcy w PDF albo wyczyść je przed wysłaniem. Za darmo, w przeglądarce.',
      h1: 'Edytuj lub usuń metadane PDF',
      intro: [
        'Każdy PDF ma ukryte właściwości: tytuł, autora, temat, słowa kluczowe, program, w którym powstał, i program, który zapisał plik. Często zdradzają nazwisko albo oprogramowanie, którego nie chciałeś ujawniać.',
        'Otwórz PDF, aby zobaczyć te właściwości, zmień dowolną z nich albo wyczyść wszystkie jednym kliknięciem i zapisz kopię. Tytuł jest wyświetlany przez przeglądarki i czytniki PDF na karcie lub pasku tytułu.',
      ],
      steps: [
        'Upuść PDF; zobaczysz jego obecne właściwości.',
        'Zmień pola albo kliknij „Clear all fields”.',
        'Kliknij „Save metadata” i pobierz plik.',
      ],
      faq: [
        ['Po co usuwać metadane?', 'Pola autora i programu mogą zdradzić Twoje nazwisko, firmę albo używane oprogramowanie. Wyczyszczenie ich przed udostępnieniem dokumentu chroni prywatność.'],
        ['Czy treść stron się zmienia?', 'Nie. Zmieniają się tylko właściwości dokumentu, strony pozostają takie same.'],
        ['Dlaczego tytuł ma znaczenie?', 'Przeglądarki i czytniki PDF pokazują go zamiast nazwy pliku, a wyszukiwarki mogą go użyć dla plików PDF opublikowanych w internecie.'],
      ],
    },
  },

  merge: {
    related: ['split', 'organize', 'compress', 'images-to-pdf'],
    en: {
      name: 'Merge PDF',
      title: 'Merge PDF free, no upload | Nyxiontech PDF Tools',
      description: 'Combine several PDF files into one, in the order you choose, right in your browser. Free, no sign-up, no file limits, and your files are never uploaded.',
      h1: 'Merge PDF files into one',
      intro: [
        'Join invoices, scans, contracts or chapters into a single PDF. Add the files, drag them into the right order and merge. The pages are copied as they are, so text stays selectable and quality does not change.',
        'Everything happens on your device, so it is fast even for large files and nothing waits in an upload queue. There is no limit on the number of files beyond your computer’s memory.',
      ],
      steps: [
        'Drop two or more PDF files, or click to choose them.',
        'Drag the files into the order you want.',
        'Click "Merge" and download the combined PDF, or open it in the editor.',
      ],
      faq: [
        ['Is there a limit on files or size?', 'No artificial limit. The files are processed in your browser, so the only limit is your device’s memory.'],
        ['Does merging reduce quality?', 'No. Pages are copied unchanged; text stays text and images keep their resolution.'],
        ['Can I reorder individual pages after merging?', 'Yes. Open the result in the editor (or use Organize pages) to move, rotate or delete single pages.'],
      ],
    },
    pl: {
      name: 'Połącz PDF',
      title: 'Połącz PDF za darmo, bez wysyłania plików | Nyxiontech',
      description: 'Połącz kilka plików PDF w jeden, w wybranej kolejności, bezpośrednio w przeglądarce. Za darmo, bez rejestracji i limitów; pliki nie są nigdzie wysyłane.',
      h1: 'Połącz pliki PDF w jeden',
      intro: [
        'Złącz faktury, skany, umowy albo rozdziały w jeden plik PDF. Dodaj pliki, przeciągnij je w odpowiedniej kolejności i połącz. Strony są kopiowane bez zmian, więc tekst można dalej zaznaczać, a jakość się nie pogarsza.',
        'Wszystko dzieje się na Twoim urządzeniu, więc nawet duże pliki łączą się szybko i bez czekania na wysyłkę. Liczbę plików ogranicza tylko pamięć komputera.',
      ],
      steps: [
        'Upuść dwa lub więcej plików PDF albo kliknij, żeby je wybrać.',
        'Przeciągnij pliki w wybranej kolejności.',
        'Kliknij „Merge” i pobierz połączony PDF albo otwórz go w edytorze.',
      ],
      faq: [
        ['Czy jest limit plików lub rozmiaru?', 'Nie ma sztucznego limitu. Pliki są przetwarzane w przeglądarce, więc ogranicza je tylko pamięć urządzenia.'],
        ['Czy łączenie obniża jakość?', 'Nie. Strony są kopiowane bez zmian: tekst pozostaje tekstem, a obrazy zachowują rozdzielczość.'],
        ['Czy mogę potem zmienić kolejność pojedynczych stron?', 'Tak. Otwórz wynik w edytorze (albo użyj narzędzia do zmiany kolejności stron), aby przesuwać, obracać lub usuwać strony.'],
      ],
    },
  },

  split: {
    related: ['merge', 'organize', 'pdf-to-images', 'rotate'],
    en: {
      name: 'Split PDF',
      title: 'Split PDF free, no upload | Nyxiontech PDF Tools',
      description: 'Split a PDF into single pages or page ranges, or extract selected pages into a new file. Free, in your browser, with a zip download for many files.',
      h1: 'Split a PDF or extract pages',
      intro: [
        'Three ways to split: every page as its own PDF; by ranges, where each range such as "1-3, 4-6, 7-" becomes a separate file; or extract chosen pages such as "1, 3-5, 9" into one new PDF.',
        'The pages are copied unchanged, so text stays selectable. When there are several results, download them one by one or all together as a .zip.',
      ],
      steps: [
        'Drop a PDF.',
        'Choose "Every page", "By ranges" or "Extract pages" and enter the pages.',
        'Click "Split PDF" and download the files or the zip.',
      ],
      faq: [
        ['How do I write page ranges?', 'Separate them with commas: "1-3, 4-6" makes two files. An open range like "7-" runs to the last page.'],
        ['How do I take a few pages out of a PDF?', 'Choose "Extract pages" and list them, e.g. "2, 5-7". They go into one new PDF; the original file is not changed.'],
        ['Does splitting reduce quality?', 'No. The pages are copied as they are.'],
      ],
    },
    pl: {
      name: 'Podziel PDF',
      title: 'Podziel PDF za darmo, bez wysyłania plików | Nyxiontech',
      description: 'Podziel PDF na pojedyncze strony lub zakresy albo wyodrębnij wybrane strony do nowego pliku. Za darmo, w przeglądarce, z pobieraniem w .zip.',
      h1: 'Podziel PDF lub wyodrębnij strony',
      intro: [
        'Trzy sposoby podziału: każda strona jako osobny PDF; według zakresów, gdzie każdy zakres, np. „1-3, 4-6, 7-”, staje się osobnym plikiem; albo wyodrębnienie wybranych stron, np. „1, 3-5, 9”, do jednego nowego pliku.',
        'Strony są kopiowane bez zmian, więc tekst można dalej zaznaczać. Gdy plików jest kilka, pobierzesz je pojedynczo albo wszystkie naraz w archiwum .zip.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wybierz „Every page”, „By ranges” lub „Extract pages” i wpisz strony.',
        'Kliknij „Split PDF” i pobierz pliki albo archiwum zip.',
      ],
      faq: [
        ['Jak wpisać zakresy stron?', 'Oddziel je przecinkami: „1-3, 4-6” daje dwa pliki. Otwarty zakres, np. „7-”, sięga do ostatniej strony.'],
        ['Jak wyciągnąć kilka stron z PDF?', 'Wybierz „Extract pages” i wypisz strony, np. „2, 5-7”. Trafią do jednego nowego pliku, a oryginał się nie zmieni.'],
        ['Czy dzielenie obniża jakość?', 'Nie. Strony są kopiowane bez zmian.'],
      ],
    },
  },

  organize: {
    related: ['merge', 'split', 'rotate', 'edit'],
    en: {
      name: 'Organize PDF pages',
      title: 'Organize PDF pages free, no upload | Nyxiontech PDF Tools',
      description: 'Reorder, rotate, duplicate and delete PDF pages by dragging thumbnails, and insert pages from other PDFs. Free, in your browser, files stay on your device.',
      h1: 'Organize PDF pages: reorder, rotate, delete',
      intro: [
        'See every page as a thumbnail and drag pages into a new order. Rotate, duplicate or delete single pages, and insert pages from other PDFs after the selected page, with undo if you change your mind.',
        'Several PDFs dropped together are combined into one document you can then rearrange. When you are done, download a new PDF; the original pages are kept as they are.',
      ],
      steps: [
        'Drop one or more PDFs; they open in the editor with the Pages panel.',
        'Drag thumbnails to reorder; use the page buttons to rotate, duplicate or delete.',
        'Use "Add PDF pages" to insert other files, then download.',
      ],
      faq: [
        ['How do I delete a page from a PDF?', 'Select the page in the Pages panel and click delete, then download. Undo brings it back if needed.'],
        ['Can I combine pages from different PDFs?', 'Yes. Drop several files at once, or use "Add PDF pages" to insert pages from another file.'],
        ['Is the work saved if I close the tab?', 'Yes. The document is autosaved in your browser and shows up under Recent documents.'],
      ],
    },
    pl: {
      name: 'Zmień kolejność stron PDF',
      title: 'Zmień kolejność stron PDF za darmo | Nyxiontech',
      description: 'Przestawiaj, obracaj, duplikuj i usuwaj strony PDF, przeciągając miniatury, oraz wstawiaj strony z innych plików. Za darmo, w przeglądarce.',
      h1: 'Uporządkuj strony PDF: kolejność, obrót, usuwanie',
      intro: [
        'Zobacz wszystkie strony jako miniatury i przeciągnij je w nowej kolejności. Obracaj, duplikuj i usuwaj pojedyncze strony oraz wstawiaj strony z innych plików PDF za zaznaczoną stroną. Każdą zmianę można cofnąć.',
        'Kilka plików upuszczonych naraz łączy się w jeden dokument, który możesz dalej układać. Na koniec pobierz nowy PDF; oryginalne strony pozostają bez zmian.',
      ],
      steps: [
        'Upuść jeden lub kilka plików PDF; otworzą się w edytorze z panelem stron.',
        'Przeciągaj miniatury, żeby zmienić kolejność; przyciskami strony obracaj, duplikuj lub usuwaj.',
        'Przyciskiem „Add PDF pages” wstaw inne pliki, a potem pobierz wynik.',
      ],
      faq: [
        ['Jak usunąć stronę z PDF?', 'Zaznacz stronę w panelu stron i kliknij usuń, a potem pobierz plik. W razie potrzeby cofnij zmianę.'],
        ['Czy mogę połączyć strony z różnych plików?', 'Tak. Upuść kilka plików naraz albo użyj „Add PDF pages”, żeby wstawić strony z innego pliku.'],
        ['Czy praca zapisze się po zamknięciu karty?', 'Tak. Dokument zapisuje się automatycznie w przeglądarce i jest widoczny w ostatnich dokumentach.'],
      ],
    },
  },

  rotate: {
    related: ['organize', 'split', 'merge', 'compress'],
    en: {
      name: 'Rotate PDF',
      title: 'Rotate PDF free, no upload | Nyxiontech PDF Tools',
      description: 'Rotate all pages of a PDF, or only the ones you choose, by 90° right, 90° left or 180°, and save the result permanently. Free, in your browser.',
      h1: 'Rotate PDF pages',
      intro: [
        'Fix scans that came out sideways or upside down. Rotate every page, or only selected ones such as "1, 3-4", by 90° to the right, 90° to the left or 180°.',
        'The rotation is saved in the file, so the pages open the right way up in every viewer and print correctly.',
      ],
      steps: [
        'Drop a PDF.',
        'Choose the rotation and whether it applies to all pages or selected ones.',
        'Click "Rotate" and download the PDF.',
      ],
      faq: [
        ['Can I rotate only one page?', 'Yes. Choose "Selected" and enter the page number, or several pages such as "2, 5-6".'],
        ['Is the rotation permanent?', 'Yes. It is saved in the PDF, not just in a viewer.'],
        ['Does rotating reduce quality?', 'No. Only the page orientation changes; the content is not re-rendered.'],
      ],
    },
    pl: {
      name: 'Obróć PDF',
      title: 'Obróć PDF za darmo, bez wysyłania plików | Nyxiontech',
      description: 'Obróć wszystkie strony PDF albo tylko wybrane o 90° w prawo, 90° w lewo lub 180° i zapisz zmianę na stałe. Za darmo, w przeglądarce.',
      h1: 'Obróć strony PDF',
      intro: [
        'Popraw skany, które wyszły bokiem albo do góry nogami. Obróć wszystkie strony lub tylko wybrane, np. „1, 3-4”, o 90° w prawo, 90° w lewo albo o 180°.',
        'Obrót zapisuje się w pliku, więc strony otwierają się prawidłowo w każdym programie i dobrze się drukują.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wybierz kąt obrotu oraz to, czy dotyczy wszystkich stron, czy tylko wybranych.',
        'Kliknij „Rotate” i pobierz PDF.',
      ],
      faq: [
        ['Czy mogę obrócić tylko jedną stronę?', 'Tak. Wybierz „Selected” i wpisz numer strony albo kilka stron, np. „2, 5-6”.'],
        ['Czy obrót jest trwały?', 'Tak. Zapisuje się w pliku PDF, a nie tylko w przeglądarce.'],
        ['Czy obracanie obniża jakość?', 'Nie. Zmienia się tylko orientacja strony, treść nie jest przetwarzana na nowo.'],
      ],
    },
  },

  compress: {
    related: ['merge', 'image-converter', 'pdf-to-images', 'split'],
    en: {
      name: 'Compress PDF',
      title: 'Compress PDF free, no upload | Nyxiontech PDF Tools',
      description: 'Make a PDF smaller for e-mail or upload limits, in your browser: a lossless repack, or three stronger levels for scans. See the size before and after.',
      h1: 'Compress a PDF',
      intro: [
        'Two approaches. Lossless repacks the file and keeps text and quality intact; savings are usually modest. Light, Recommended and Strong turn each page into a compressed image (150, 120 or 85 dpi), which shrinks scanned documents a lot.',
        'The stronger levels are best for scans and photos: after them, text can no longer be selected or searched. You see the size before and after, so you can keep the original if the saving is small.',
      ],
      steps: [
        'Drop a PDF.',
        'Choose a level: Lossless for documents with text, Recommended or Strong for scans.',
        'Click "Compress", compare the sizes and download.',
      ],
      faq: [
        ['Which level should I choose?', 'For a PDF made from Word or a website, try Lossless first. For scans and photographed documents, Recommended usually gives the best balance of size and readability.'],
        ['Why can I no longer select text after compressing?', 'Light, Recommended and Strong turn pages into images. If you need searchable text, run the result through OCR, or use Lossless.'],
        ['The file did not get smaller. Why?', 'It was already compact. Try a stronger level, or keep the original.'],
      ],
    },
    pl: {
      name: 'Kompresuj PDF',
      title: 'Kompresuj PDF za darmo, bez wysyłania | Nyxiontech',
      description: 'Zmniejsz PDF do wysłania e-mailem lub przez formularz, w przeglądarce: bezstratnie albo mocniej (dla skanów). Widać rozmiar przed i po. Za darmo.',
      h1: 'Zmniejsz rozmiar pliku PDF',
      intro: [
        'Dwa podejścia. Tryb bezstratny (Lossless) zapisuje plik na nowo i zachowuje tekst oraz jakość; oszczędność jest zwykle niewielka. Poziomy Light, Recommended i Strong zamieniają każdą stronę w skompresowany obraz (150, 120 lub 85 dpi), co mocno zmniejsza zeskanowane dokumenty.',
        'Mocniejsze poziomy najlepiej sprawdzają się przy skanach i zdjęciach: po nich tekstu nie da się już zaznaczać ani wyszukiwać. Widzisz rozmiar przed i po, więc jeśli zysk jest mały, możesz zostać przy oryginale.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wybierz poziom: Lossless dla dokumentów z tekstem, Recommended lub Strong dla skanów.',
        'Kliknij „Compress”, porównaj rozmiary i pobierz plik.',
      ],
      faq: [
        ['Który poziom wybrać?', 'Dla PDF z Worda lub strony internetowej najpierw spróbuj Lossless. Dla skanów i zdjęć dokumentów Recommended zwykle daje najlepszy kompromis między rozmiarem a czytelnością.'],
        ['Dlaczego po kompresji nie mogę zaznaczyć tekstu?', 'Poziomy Light, Recommended i Strong zamieniają strony w obrazy. Jeśli potrzebujesz tekstu, przepuść wynik przez OCR albo użyj Lossless.'],
        ['Plik się nie zmniejszył. Dlaczego?', 'Był już dobrze skompresowany. Spróbuj mocniejszego poziomu albo zostaw oryginał.'],
      ],
    },
  },

  ocr: {
    related: ['pdf-to-text', 'pdf-to-word', 'images-to-pdf', 'compress'],
    en: {
      name: 'OCR PDF',
      title: 'OCR PDF free: searchable scans | Nyxiontech PDF Tools',
      description: 'Turn scanned PDFs and photos of documents into searchable PDFs with selectable text. Polish and English, runs on your device with Tesseract. Free.',
      h1: 'OCR: make a scanned PDF searchable',
      intro: [
        'A scan is just a picture of text: you cannot search it, select it or copy from it. OCR (optical character recognition) reads the words on each page and adds them as an invisible text layer over the unchanged image, so the PDF looks exactly the same but Ctrl+F, copy and paste work.',
        'It recognises Polish and English with Tesseract, running entirely on your device. Choose Fast, Accurate (300 dpi, about 10 seconds per page) or Small print. Pages that already contain text can be skipped, and photos of documents become one PDF.',
      ],
      steps: [
        'Drop a scanned PDF, or several photos of pages (they become one PDF in the order shown).',
        'Choose the language and quality.',
        'Click "Recognise text" and download the searchable PDF, or copy the recognised text.',
      ],
      faq: [
        ['Which languages are supported?', 'Polish and English, separately or together.'],
        ['Does OCR change how the PDF looks?', 'No. The page images stay untouched; the text is added as an invisible layer on top.'],
        ['How long does it take?', 'About 10 seconds per page at the Accurate setting, depending on your computer. The first run in the browser also loads the language data from this site.'],
      ],
    },
    pl: {
      name: 'OCR PDF',
      title: 'OCR PDF po polsku za darmo: skan na tekst | Nyxiontech',
      description: 'Zamień zeskanowany PDF lub zdjęcia dokumentów w PDF z wyszukiwalnym tekstem. Język polski i angielski, działa na Twoim komputerze. Za darmo.',
      h1: 'OCR: rozpoznaj tekst w zeskanowanym PDF',
      intro: [
        'Skan to tylko obraz tekstu: nie da się go przeszukać, zaznaczyć ani skopiować. OCR (optyczne rozpoznawanie znaków) odczytuje słowa na każdej stronie i dodaje je jako niewidoczną warstwę tekstu nad niezmienionym obrazem. PDF wygląda tak samo, ale działa Ctrl+F, kopiowanie i wklejanie.',
        'Rozpoznaje język polski i angielski (silnik Tesseract), w całości na Twoim urządzeniu. Wybierz tryb szybki, dokładny (300 dpi, około 10 sekund na stronę) albo do drobnego druku. Strony, które już mają tekst, mogą zostać pominięte, a zdjęcia dokumentów łączą się w jeden PDF.',
      ],
      steps: [
        'Upuść zeskanowany PDF albo kilka zdjęć stron (powstanie z nich jeden PDF w podanej kolejności).',
        'Wybierz język i jakość.',
        'Kliknij „Recognise text” i pobierz przeszukiwalny PDF albo skopiuj rozpoznany tekst.',
      ],
      faq: [
        ['Jakie języki są obsługiwane?', 'Polski i angielski, osobno lub razem.'],
        ['Czy OCR zmienia wygląd PDF?', 'Nie. Obrazy stron pozostają nietknięte, a tekst jest dodawany jako niewidoczna warstwa.'],
        ['Ile to trwa?', 'Około 10 sekund na stronę w trybie dokładnym, zależnie od komputera. Przy pierwszym użyciu w przeglądarce pobierane są też dane języka z tej strony.'],
      ],
    },
  },

  'images-to-pdf': {
    related: ['heic-to-jpg', 'merge', 'compress', 'ocr'],
    en: {
      name: 'Image to PDF',
      title: 'Image to PDF free: JPG, PNG, HEIC | Nyxiontech PDF Tools',
      description: 'Turn JPG, PNG, WebP, GIF or iPhone HEIC photos into one PDF, one image per page. A4, Letter or image size, with margins. Free, in your browser.',
      h1: 'Convert images to PDF (JPG, PNG, HEIC)',
      intro: [
        'Put photos of receipts, documents or drawings into one PDF, one image per page. It accepts JPG, PNG, WebP, GIF and HEIC photos straight from an iPhone, and you can drag them into the right order first.',
        'Choose A4, Letter or a page the size of each image, portrait, landscape or automatic orientation, and no, small or large margins.',
      ],
      steps: [
        'Drop your images.',
        'Drag them into order and pick the page size, orientation and margin.',
        'Click "Create PDF" and download it.',
      ],
      faq: [
        ['Can I convert iPhone photos (HEIC)?', 'Yes. HEIC photos are decoded in your browser, with no app or upload needed.'],
        ['Can I make the text in the photos searchable?', 'Use OCR: it accepts photos directly and produces a searchable PDF.'],
        ['What page size is used?', 'A4 by default. You can switch to Letter, or make each page the size of its image.'],
      ],
    },
    pl: {
      name: 'JPG do PDF',
      title: 'JPG do PDF za darmo (też PNG i HEIC) | Nyxiontech',
      description: 'Zamień zdjęcia JPG, PNG, WebP, GIF lub HEIC z iPhone’a w jeden PDF, jedno zdjęcie na stronę. A4, Letter lub rozmiar zdjęcia. Za darmo, w przeglądarce.',
      h1: 'Zamień zdjęcia na PDF (JPG, PNG, HEIC)',
      intro: [
        'Złóż zdjęcia paragonów, dokumentów czy rysunków w jeden PDF, jedno zdjęcie na stronę. Obsługiwane są pliki JPG, PNG, WebP, GIF oraz zdjęcia HEIC prosto z iPhone’a, a kolejność możesz wcześniej ustawić przeciąganiem.',
        'Wybierz format A4, Letter albo stronę w rozmiarze zdjęcia, orientację pionową, poziomą lub automatyczną oraz margines: brak, mały lub duży.',
      ],
      steps: [
        'Upuść zdjęcia.',
        'Ułóż je w kolejności i wybierz rozmiar strony, orientację i margines.',
        'Kliknij „Create PDF” i pobierz plik.',
      ],
      faq: [
        ['Czy mogę zamienić zdjęcia z iPhone’a (HEIC)?', 'Tak. Zdjęcia HEIC są dekodowane w przeglądarce, bez instalowania aplikacji i bez wysyłania.'],
        ['Czy tekst ze zdjęć da się przeszukiwać?', 'Użyj OCR: przyjmuje zdjęcia bezpośrednio i tworzy PDF z wyszukiwalnym tekstem.'],
        ['Jaki jest rozmiar strony?', 'Domyślnie A4. Możesz wybrać Letter albo stronę w rozmiarze każdego zdjęcia.'],
      ],
    },
  },

  'pdf-to-images': {
    related: ['images-to-pdf', 'split', 'compress', 'pdf-to-text'],
    en: {
      name: 'PDF to JPG',
      title: 'PDF to JPG or PNG free, no upload | Nyxiontech PDF Tools',
      description: 'Save every PDF page, or the pages you choose, as JPG or PNG images at 72, 150 or 300 dpi. Download them one by one or as a zip. Free, in your browser.',
      h1: 'Convert PDF to JPG or PNG images',
      intro: [
        'Turn PDF pages into images for a presentation, a website or a message. Choose JPG for small files or PNG for sharp text and graphics, and a resolution: 72 dpi for screens, 150 dpi as a standard, or 300 dpi for print.',
        'Convert all pages or only some, such as "1, 3-5". Each page becomes its own image, and many pages can be downloaded together as a .zip.',
      ],
      steps: [
        'Drop a PDF.',
        'Choose JPG or PNG, the resolution and, optionally, the pages.',
        'Click "Convert" and download the images or the zip.',
      ],
      faq: [
        ['JPG or PNG?', 'JPG makes smaller files and suits photos and scans. PNG keeps text and line art perfectly sharp but is larger.'],
        ['Which resolution should I use?', '150 dpi is good for screens and documents; choose 300 dpi if the images will be printed.'],
        ['Can I convert only one page?', 'Yes. Enter its number under Pages.'],
      ],
    },
    pl: {
      name: 'PDF do JPG',
      title: 'PDF do JPG lub PNG za darmo | Nyxiontech',
      description: 'Zapisz każdą stronę PDF albo wybrane strony jako obrazy JPG lub PNG w 72, 150 lub 300 dpi. Pobierz pojedynczo albo w .zip. Za darmo, w przeglądarce.',
      h1: 'Zamień PDF na obrazy JPG lub PNG',
      intro: [
        'Zamień strony PDF w obrazy do prezentacji, na stronę internetową albo do wiadomości. Wybierz JPG, jeśli liczy się mały rozmiar, albo PNG dla ostrego tekstu i grafiki, oraz rozdzielczość: 72 dpi na ekran, 150 dpi standardowo lub 300 dpi do druku.',
        'Przekonwertuj wszystkie strony albo tylko wybrane, np. „1, 3-5”. Każda strona staje się osobnym obrazem, a wiele stron pobierzesz razem w archiwum .zip.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wybierz JPG lub PNG, rozdzielczość i opcjonalnie strony.',
        'Kliknij „Convert” i pobierz obrazy albo archiwum zip.',
      ],
      faq: [
        ['JPG czy PNG?', 'JPG daje mniejsze pliki i pasuje do zdjęć i skanów. PNG zachowuje idealnie ostry tekst i grafikę, ale pliki są większe.'],
        ['Jaką rozdzielczość wybrać?', '150 dpi wystarcza na ekran i do dokumentów; jeśli obrazy będą drukowane, wybierz 300 dpi.'],
        ['Czy mogę zamienić tylko jedną stronę?', 'Tak. Wpisz jej numer w polu Pages.'],
      ],
    },
  },

  'pdf-to-text': {
    related: ['ocr', 'pdf-to-word', 'pdf-to-images', 'compare'],
    en: {
      name: 'PDF to text',
      title: 'PDF to text free, no upload | Nyxiontech PDF Tools',
      description: 'Extract the text from a PDF to copy it or save it as a .txt file, right in your browser. Scanned PDFs can be made readable with OCR first. Free.',
      h1: 'Extract text from a PDF',
      intro: [
        'Get the plain text out of a PDF: copy it to the clipboard with one click or save it as a .txt file. Useful for quoting, translating, or feeding a document into another program.',
        'This reads the text the PDF already contains. A scanned document has no text, only images of it; run it through OCR first and then extract the text.',
      ],
      steps: [
        'Drop a PDF.',
        'Click "Extract text".',
        'Copy the text, or download it as a .txt file.',
      ],
      faq: [
        ['Why is no text found?', 'The PDF is probably a scan. Use OCR to recognise the text first.'],
        ['Is the formatting kept?', 'No, you get plain text. To keep paragraphs and bold text in an editable document, use PDF to Word.'],
        ['Does it handle Polish characters?', 'Yes. The text is saved as UTF-8, so Polish and other characters come through correctly.'],
      ],
    },
    pl: {
      name: 'PDF do tekstu',
      title: 'PDF do tekstu za darmo, bez wysyłania | Nyxiontech',
      description: 'Wyciągnij tekst z PDF, żeby go skopiować albo zapisać jako plik .txt, w przeglądarce. Zeskanowane PDF najpierw przepuść przez OCR. Za darmo.',
      h1: 'Wyciągnij tekst z PDF',
      intro: [
        'Pobierz sam tekst z pliku PDF: skopiuj go do schowka jednym kliknięciem albo zapisz jako plik .txt. Przydaje się do cytowania, tłumaczenia albo przeniesienia treści do innego programu.',
        'Narzędzie odczytuje tekst zapisany w pliku PDF. Zeskanowany dokument nie ma tekstu, tylko jego obraz; najpierw przepuść go przez OCR, a potem wyciągnij tekst.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Kliknij „Extract text”.',
        'Skopiuj tekst albo pobierz go jako plik .txt.',
      ],
      faq: [
        ['Dlaczego nie znaleziono tekstu?', 'PDF jest najpewniej skanem. Najpierw rozpoznaj tekst narzędziem OCR.'],
        ['Czy formatowanie zostaje zachowane?', 'Nie, dostajesz czysty tekst. Aby zachować akapity i pogrubienia w edytowalnym dokumencie, użyj konwersji PDF do Word.'],
        ['Czy polskie znaki działają?', 'Tak. Tekst jest zapisywany w UTF-8, więc polskie znaki przechodzą bez problemu.'],
      ],
    },
  },

  'pdf-to-word': {
    related: ['word-to-pdf', 'pdf-to-text', 'ocr', 'edit'],
    en: {
      name: 'PDF to Word',
      title: 'PDF to Word (.docx) free, no upload | Nyxiontech PDF Tools',
      description: 'Convert a PDF into an editable Word .docx that keeps its text, paragraphs, bold and font sizes, in your browser. Free; best for text documents.',
      h1: 'Convert PDF to Word (.docx)',
      intro: [
        'Get an editable Word document from a PDF. The converter keeps the text, paragraphs, bold and font sizes, so a letter, report or contract can be edited in Word, LibreOffice or Google Docs.',
        'It is honest about its limits: tables, columns and images are not reproduced, so complex layouts need retouching. Scanned PDFs contain no text; run them through OCR first.',
      ],
      steps: [
        'Drop a PDF.',
        'Click "Convert to Word".',
        'Download the .docx and open it in your word processor.',
      ],
      faq: [
        ['Are tables and images kept?', 'No. Text, paragraphs, bold and sizes are kept; tables, columns and images are not. For complex layouts, expect to adjust the document.'],
        ['Can I convert a scanned PDF?', 'Run it through OCR first so it has text, then convert it.'],
        ['Which programs open the result?', 'Any that read .docx: Microsoft Word, LibreOffice Writer, Google Docs and others.'],
      ],
    },
    pl: {
      name: 'PDF do Word',
      title: 'PDF do Word (.docx) za darmo | Nyxiontech',
      description: 'Zamień PDF na edytowalny plik Word .docx z tekstem, akapitami, pogrubieniami i rozmiarami czcionek, w przeglądarce. Za darmo, bez wysyłania pliku.',
      h1: 'Zamień PDF na Word (.docx)',
      intro: [
        'Zrób z pliku PDF edytowalny dokument Word. Konwerter zachowuje tekst, akapity, pogrubienia i rozmiary czcionek, więc list, raport czy umowę poprawisz w Wordzie, LibreOffice albo Dokumentach Google.',
        'Mówimy uczciwie o ograniczeniach: tabele, kolumny i obrazy nie są odtwarzane, więc złożony układ wymaga poprawek. Zeskanowane PDF nie zawierają tekstu; najpierw przepuść je przez OCR.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Kliknij „Convert to Word”.',
        'Pobierz plik .docx i otwórz go w edytorze tekstu.',
      ],
      faq: [
        ['Czy tabele i obrazy są zachowane?', 'Nie. Zostaje tekst, akapity, pogrubienia i rozmiary; tabele, kolumny i obrazy nie. Przy złożonym układzie dokument trzeba będzie poprawić.'],
        ['Czy mogę zamienić zeskanowany PDF?', 'Najpierw przepuść go przez OCR, żeby miał tekst, a potem przekonwertuj.'],
        ['W jakich programach otworzę wynik?', 'W każdym, który czyta .docx: Microsoft Word, LibreOffice Writer, Dokumenty Google i inne.'],
      ],
    },
  },

  'word-to-pdf': {
    related: ['pdf-to-word', 'merge', 'compress', 'protect'],
    en: {
      name: 'Word to PDF',
      title: 'Word to PDF free, no upload | Nyxiontech PDF Tools',
      description: 'Open a Word .docx in your browser, preview it and save it as a PDF through the print dialog. Free and private; basic layouts only, no upload.',
      h1: 'Convert Word (.docx) to PDF',
      intro: [
        'Open a .docx file, check the preview and save it as a PDF with your browser’s print dialog: choose "Save as PDF" (or "Microsoft Print to PDF") as the printer. Nothing is uploaded and no Office installation is needed.',
        'The document is converted to a simple web layout first, so headings, paragraphs, lists, bold and basic tables come through, but complex layouts, custom styles and exact page breaks may differ from Word. Older .doc files need to be saved as .docx in Word first.',
      ],
      steps: [
        'Drop a .docx file and check the preview.',
        'Click "Save as PDF…".',
        'In the print dialog, pick "Save as PDF" as the printer and save.',
      ],
      faq: [
        ['Will the PDF look exactly like in Word?', 'Not always. Simple documents convert well; complex layouts, headers and exact page breaks need Word or LibreOffice for a faithful PDF.'],
        ['Can I convert .doc files?', 'Only .docx. Open the .doc in Word or LibreOffice and save it as .docx first.'],
        ['Why does a print dialog open?', 'The browser’s print engine creates the PDF on your device; choosing "Save as PDF" writes the file instead of printing.'],
      ],
    },
    pl: {
      name: 'Word do PDF',
      title: 'Word do PDF za darmo, bez wysyłania | Nyxiontech',
      description: 'Otwórz plik Word .docx w przeglądarce, sprawdź podgląd i zapisz go jako PDF przez okno drukowania. Za darmo i prywatnie; dla prostych układów.',
      h1: 'Zamień Word (.docx) na PDF',
      intro: [
        'Otwórz plik .docx, sprawdź podgląd i zapisz go jako PDF w oknie drukowania przeglądarki: jako drukarkę wybierz „Zapisz jako PDF” (lub „Microsoft Print to PDF”). Nic nie jest wysyłane i nie potrzebujesz pakietu Office.',
        'Dokument jest najpierw zamieniany na prosty układ strony internetowej, więc nagłówki, akapity, listy, pogrubienia i proste tabele przechodzą, ale złożony układ, własne style i dokładne podziały stron mogą się różnić od Worda. Starsze pliki .doc trzeba najpierw zapisać w Wordzie jako .docx.',
      ],
      steps: [
        'Upuść plik .docx i sprawdź podgląd.',
        'Kliknij „Save as PDF…”.',
        'W oknie drukowania wybierz drukarkę „Zapisz jako PDF” i zapisz plik.',
      ],
      faq: [
        ['Czy PDF będzie wyglądał dokładnie jak w Wordzie?', 'Nie zawsze. Proste dokumenty wychodzą dobrze; przy złożonym układzie, nagłówkach i dokładnych podziałach stron wierny PDF zrobisz w Wordzie lub LibreOffice.'],
        ['Czy mogę zamienić plik .doc?', 'Tylko .docx. Otwórz plik .doc w Wordzie lub LibreOffice i zapisz go jako .docx.'],
        ['Dlaczego otwiera się okno drukowania?', 'PDF tworzy mechanizm drukowania przeglądarki na Twoim urządzeniu; wybór „Zapisz jako PDF” zapisuje plik zamiast go drukować.'],
      ],
    },
  },

  protect: {
    related: ['unlock', 'redact', 'watermark', 'metadata'],
    en: {
      name: 'Protect PDF',
      title: 'Password protect PDF free (AES-256) | Nyxiontech PDF Tools',
      description: 'Add a password to a PDF with AES-256 encryption and choose whether printing, copying and editing are allowed. Free, in your browser, no upload.',
      h1: 'Password-protect a PDF',
      intro: [
        'Encrypt a PDF with AES-256 so that only people who know the password can open it. Useful before sending payslips, medical results or contracts by e-mail.',
        'You can also allow or block printing, copying text and images, and editing. Adobe Reader, browsers and most viewers honour these permissions, though some tools ignore them. An optional owner password lets you change the permissions later.',
      ],
      steps: [
        'Drop a PDF.',
        'Enter the password twice and choose the permissions.',
        'Click "Protect PDF" and download the encrypted file.',
      ],
      faq: [
        ['How strong is the protection?', 'The file is encrypted with AES-256, the strongest method the PDF format offers. A long, unique password matters most.'],
        ['What if I forget the password?', 'It cannot be recovered, by us or anyone else. Keep it somewhere safe.'],
        ['Is the password sent anywhere?', 'No. Encryption happens in your browser; the password and the file stay on your device.'],
      ],
    },
    pl: {
      name: 'Zabezpiecz PDF hasłem',
      title: 'Zabezpiecz PDF hasłem (AES-256) za darmo | Nyxiontech',
      description: 'Dodaj hasło do PDF z szyfrowaniem AES-256 i zdecyduj, czy można drukować, kopiować i edytować. Za darmo, w przeglądarce, bez wysyłania pliku.',
      h1: 'Zabezpiecz PDF hasłem',
      intro: [
        'Zaszyfruj PDF algorytmem AES-256, aby otworzyć go mogły tylko osoby znające hasło. Przydaje się przed wysłaniem e-mailem pasków wypłat, wyników badań czy umów.',
        'Możesz też zezwolić na drukowanie, kopiowanie tekstu i obrazów oraz edycję albo je zablokować. Adobe Reader, przeglądarki i większość czytników respektują te uprawnienia, choć niektóre programy je ignorują. Opcjonalne hasło właściciela pozwala później zmienić uprawnienia.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wpisz hasło dwa razy i wybierz uprawnienia.',
        'Kliknij „Protect PDF” i pobierz zaszyfrowany plik.',
      ],
      faq: [
        ['Jak mocne jest zabezpieczenie?', 'Plik jest szyfrowany AES-256, najmocniejszą metodą dostępną w formacie PDF. Najważniejsze jest długie, unikalne hasło.'],
        ['Co jeśli zapomnę hasła?', 'Nie da się go odzyskać, ani nam, ani nikomu innemu. Zapisz je w bezpiecznym miejscu.'],
        ['Czy hasło jest gdzieś wysyłane?', 'Nie. Szyfrowanie odbywa się w przeglądarce; hasło i plik zostają na Twoim urządzeniu.'],
      ],
    },
  },

  unlock: {
    related: ['protect', 'compress', 'merge', 'edit'],
    en: {
      name: 'Unlock PDF',
      title: 'Unlock PDF: remove password free | Nyxiontech PDF Tools',
      description: 'Remove the password and printing or copying restrictions from a PDF you are allowed to open, and save an unlocked copy. Free, in your browser.',
      h1: 'Unlock a PDF: remove the password',
      intro: [
        'Tired of typing the password every time you open a bank statement or invoice? Enter it once and save a copy without encryption.',
        'For PDFs that open without a password but block printing or copying, leave the password empty: the restrictions are removed. This tool does not guess or crack unknown passwords; you need the password to unlock a file that asks for one.',
      ],
      steps: [
        'Drop the protected PDF.',
        'Enter its password, or leave the field empty if it only restricts printing or copying.',
        'Click "Unlock PDF" and download the unlocked copy.',
      ],
      faq: [
        ['Can it open a PDF if I don’t know the password?', 'No. It removes protection only from files you can open, using the password you enter.'],
        ['My PDF opens fine but I can’t print it. Will this help?', 'Yes. Leave the password empty; the printing and copying restrictions are removed.'],
        ['Is the original changed?', 'No. You download a new, unlocked copy; the protected file stays as it was.'],
      ],
    },
    pl: {
      name: 'Odblokuj PDF',
      title: 'Odblokuj PDF: usuń hasło za darmo | Nyxiontech',
      description: 'Usuń hasło oraz blokadę drukowania lub kopiowania z PDF, który możesz otworzyć. Wpisz hasło raz i zapisz odblokowaną kopię. Za darmo, bez wysyłania.',
      h1: 'Odblokuj PDF: usuń hasło',
      intro: [
        'Masz dość wpisywania hasła przy każdym otwarciu wyciągu bankowego czy faktury? Wpisz je raz i zapisz kopię bez szyfrowania.',
        'Jeśli PDF otwiera się bez hasła, ale blokuje drukowanie lub kopiowanie, zostaw pole hasła puste: ograniczenia zostaną usunięte. Narzędzie nie zgaduje ani nie łamie nieznanych haseł; do odblokowania pliku, który pyta o hasło, musisz je znać.',
      ],
      steps: [
        'Upuść zabezpieczony PDF.',
        'Wpisz hasło albo zostaw puste pole, jeśli plik blokuje tylko drukowanie lub kopiowanie.',
        'Kliknij „Unlock PDF” i pobierz odblokowaną kopię.',
      ],
      faq: [
        ['Czy otworzy PDF, jeśli nie znam hasła?', 'Nie. Usuwa zabezpieczenie tylko z plików, które możesz otworzyć, przy użyciu wpisanego hasła.'],
        ['PDF się otwiera, ale nie mogę go wydrukować. Czy to pomoże?', 'Tak. Zostaw pole hasła puste; blokada drukowania i kopiowania zostanie usunięta.'],
        ['Czy oryginał się zmienia?', 'Nie. Pobierasz nową, odblokowaną kopię, a zabezpieczony plik zostaje bez zmian.'],
      ],
    },
  },

  redact: {
    related: ['metadata', 'protect', 'compare', 'edit'],
    en: {
      name: 'Redact PDF',
      title: 'Redact PDF free: really remove text | Nyxiontech PDF Tools',
      description: 'Black out names, e-mails, phone numbers, IBANs or any text in a PDF. Redacted pages are re-rendered, so the hidden text is removed, not just covered. Free.',
      h1: 'Redact a PDF: remove sensitive data for good',
      intro: [
        'Drawing a black box in a normal editor only covers text: anyone can still copy it from underneath. Here, every page with a redaction is re-rendered as an image with the boxes burnt in, so the hidden text is really gone from the file.',
        'Find text to redact by typing it, by ready patterns (e-mail addresses, phone numbers, bank account numbers and IBANs, Polish NIP and PESEL numbers), or by drawing boxes by hand. Comments and form field values that contain the searched text are removed from the other pages too.',
      ],
      steps: [
        'Drop a PDF.',
        'Search for text, tick patterns, or drag boxes over the areas to hide; check the preview.',
        'Click "Redact and save" and download the redacted PDF.',
      ],
      faq: [
        ['Can the redacted text be recovered?', 'No. Pages with redactions are rebuilt from an image with the boxes burnt in; the original text, comments and form fields on those pages are not in the output.'],
        ['What happens to pages without redactions?', 'They stay as they are, with selectable text, except that comments and form values matching your search or patterns are removed.'],
        ['Can I still search the redacted pages?', 'Not directly, because they are now images. Run the result through OCR if you need the remaining text to be searchable.'],
      ],
    },
    pl: {
      name: 'Anonimizuj PDF',
      title: 'Anonimizacja PDF: trwale usuń dane | Nyxiontech',
      description: 'Zaczernij nazwiska, e-maile, telefony, numery kont, NIP, PESEL lub dowolny tekst w PDF. Dane są naprawdę usuwane, a nie tylko zakrywane. Za darmo.',
      h1: 'Anonimizuj PDF: trwale usuń dane osobowe',
      intro: [
        'Czarny prostokąt narysowany w zwykłym edytorze tylko zakrywa tekst: każdy może go skopiować spod spodu. Tutaj każda strona z zaczernieniem jest renderowana na nowo jako obraz z wtopionymi prostokątami, więc ukryty tekst naprawdę znika z pliku.',
        'Tekst do usunięcia znajdziesz, wpisując go, przez gotowe wzorce (adresy e-mail, numery telefonów, numery kont i IBAN, NIP i PESEL) albo zaznaczając obszary ręcznie. Komentarze i wartości pól formularza zawierające szukany tekst są usuwane także z pozostałych stron.',
      ],
      steps: [
        'Upuść plik PDF.',
        'Wyszukaj tekst, zaznacz wzorce albo przeciągnij prostokąty nad obszarami do ukrycia; sprawdź podgląd.',
        'Kliknij „Redact and save” i pobierz zanonimizowany PDF.',
      ],
      faq: [
        ['Czy usunięty tekst da się odzyskać?', 'Nie. Strony z zaczernieniami są odtwarzane z obrazu z wtopionymi prostokątami; oryginalnego tekstu, komentarzy i pól formularza z tych stron nie ma w pliku wynikowym.'],
        ['Co ze stronami bez zaczernień?', 'Zostają bez zmian, z zaznaczalnym tekstem, poza tym, że usuwane są komentarze i wartości pól pasujące do wyszukiwania lub wzorców.'],
        ['Czy zanonimizowane strony da się przeszukiwać?', 'Nie bezpośrednio, bo są teraz obrazami. Jeśli pozostały tekst ma być wyszukiwalny, przepuść wynik przez OCR.'],
      ],
    },
  },

  compare: {
    related: ['pdf-to-text', 'redact', 'merge', 'pdf-to-word'],
    en: {
      name: 'Compare PDF',
      title: 'Compare two PDFs free, no upload | Nyxiontech PDF Tools',
      description: 'Find the differences between two versions of a PDF: changed lines of text and highlighted visual changes on each page. Free, private, in your browser.',
      h1: 'Compare two PDF files',
      intro: [
        'Got a new version of a contract or offer and want to know what changed? Add the original and the changed PDF. You get the added and removed lines of text page by page, and a visual view where areas only in the original are marked red and areas only in the new version green.',
        'The visual comparison also catches changes that are not text, such as a moved logo, a new signature or a swapped image.',
      ],
      steps: [
        'Choose the original PDF and the changed PDF.',
        'Click "Compare".',
        'Switch between "Text changes" and "Visual changes" to review each page.',
      ],
      faq: [
        ['Does it work with scanned PDFs?', 'The visual comparison does. The text comparison needs text in the PDF; run scans through OCR first.'],
        ['What do the colours mean?', 'Red marks what is only in the original, green what is only in the changed version.'],
        ['Are the documents sent anywhere for comparison?', 'No. Both files are compared in your browser.'],
      ],
    },
    pl: {
      name: 'Porównaj PDF',
      title: 'Porównaj dwa pliki PDF za darmo | Nyxiontech',
      description: 'Znajdź różnice między dwiema wersjami PDF: zmienione wiersze tekstu i zaznaczone zmiany wizualne na każdej stronie. Za darmo, prywatnie, w przeglądarce.',
      h1: 'Porównaj dwa pliki PDF',
      intro: [
        'Dostałeś nową wersję umowy albo oferty i chcesz wiedzieć, co się zmieniło? Dodaj oryginał i zmieniony PDF. Zobaczysz dodane i usunięte wiersze tekstu strona po stronie oraz widok graficzny, w którym obszary obecne tylko w oryginale są czerwone, a tylko w nowej wersji zielone.',
        'Porównanie wizualne wychwytuje też zmiany, które nie są tekstem, na przykład przesunięte logo, nowy podpis albo podmieniony obraz.',
      ],
      steps: [
        'Wybierz oryginalny PDF i zmieniony PDF.',
        'Kliknij „Compare”.',
        'Przełączaj „Text changes” i „Visual changes”, żeby przejrzeć każdą stronę.',
      ],
      faq: [
        ['Czy działa ze skanami?', 'Porównanie wizualne tak. Porównanie tekstu wymaga tekstu w PDF; skany najpierw przepuść przez OCR.'],
        ['Co oznaczają kolory?', 'Czerwony to to, co jest tylko w oryginale, zielony to, co jest tylko w zmienionej wersji.'],
        ['Czy dokumenty są gdzieś wysyłane do porównania?', 'Nie. Oba pliki są porównywane w przeglądarce.'],
      ],
    },
  },

  'image-converter': {
    related: ['heic-to-jpg', 'remove-background', 'images-to-pdf', 'compress'],
    en: {
      name: 'Image converter',
      title: 'Compress & convert images: JPG, PNG, WebP | Nyxiontech',
      description: 'Shrink, resize and convert many images at once between JPG, PNG and WebP, in your browser. Location and camera data (EXIF) are removed. Free, no upload.',
      h1: 'Compress and convert images',
      intro: [
        'Make photos small enough for e-mail, a website or an upload form. Convert JPG, PNG, WebP, GIF, BMP and HEIC images to JPG, WebP (smallest files) or PNG (lossless, keeps transparency), set the quality, and optionally shrink anything larger than a maximum width and height.',
        'Convert a whole batch at once and download the results as a zip. The total size before and after is shown, and location and camera data (EXIF) are stripped from every image.',
      ],
      steps: [
        'Drop your images.',
        'Choose JPG, WebP or PNG, the quality, and a maximum size if you want to resize.',
        'Click "Convert" and download the images or the zip.',
      ],
      faq: [
        ['What quality should I use?', '70–85% is usually indistinguishable from the original and much smaller.'],
        ['Is GPS location removed from photos?', 'Yes. The images are re-encoded without EXIF data, so location, camera model and date are not included.'],
        ['Should I use WebP?', 'WebP gives the smallest files and opens in all modern browsers; JPG is the safest choice for older programs.'],
      ],
    },
    pl: {
      name: 'Kompresja zdjęć',
      title: 'Kompresja zdjęć i konwersja JPG, PNG, WebP | Nyxiontech',
      description: 'Zmniejsz, przeskaluj i przekonwertuj wiele zdjęć naraz między JPG, PNG i WebP w przeglądarce. Lokalizacja i dane aparatu (EXIF) są usuwane. Za darmo.',
      h1: 'Kompresuj i konwertuj zdjęcia',
      intro: [
        'Zmniejsz zdjęcia tak, żeby zmieściły się w e-mailu, na stronie internetowej albo w formularzu. Konwertuj obrazy JPG, PNG, WebP, GIF, BMP i HEIC do JPG, WebP (najmniejsze pliki) lub PNG (bezstratnie, z przezroczystością), ustaw jakość i opcjonalnie zmniejsz wszystko, co przekracza zadaną szerokość i wysokość.',
        'Przetwórz całą paczkę naraz i pobierz wyniki w archiwum zip. Widać łączny rozmiar przed i po, a lokalizacja i dane aparatu (EXIF) są usuwane z każdego zdjęcia.',
      ],
      steps: [
        'Upuść zdjęcia.',
        'Wybierz JPG, WebP lub PNG, jakość i maksymalny rozmiar, jeśli chcesz zmniejszyć wymiary.',
        'Kliknij „Convert” i pobierz zdjęcia albo archiwum zip.',
      ],
      faq: [
        ['Jaką jakość wybrać?', '70–85% zwykle nie różni się wizualnie od oryginału, a plik jest dużo mniejszy.'],
        ['Czy lokalizacja GPS jest usuwana ze zdjęć?', 'Tak. Zdjęcia są zapisywane na nowo bez danych EXIF, więc nie zawierają lokalizacji, modelu aparatu ani daty.'],
        ['Czy używać WebP?', 'WebP daje najmniejsze pliki i działa we wszystkich nowoczesnych przeglądarkach; JPG to najbezpieczniejszy wybór dla starszych programów.'],
      ],
    },
  },

  'remove-background': {
    related: ['image-converter', 'heic-to-jpg', 'sign', 'images-to-pdf'],
    en: {
      name: 'Remove background',
      title: 'Remove image background free, on-device | Nyxiontech',
      description: 'Cut out products, people or logos and get a transparent PNG. An AI model runs on your device, or remove a plain-colour background. Free, no upload.',
      h1: 'Remove the background from an image',
      intro: [
        'Get a transparent PNG of a product, a person or a logo. For photos, an AI model (U²-Net) finds the main subject and runs entirely on your device; the first run loads the model, about 5 MB, from this site. It works best with one clear subject.',
        'For logos, scans and studio shots, the plain-colour method removes the colour around the edges (white paper, a backdrop) with an adjustable tolerance. Keep the background transparent or fill it with a colour of your choice.',
      ],
      steps: [
        'Drop one or more images (JPG, PNG, WebP or HEIC).',
        'Choose "AI: photos" or "Plain colour: logos, scans", and a transparent or coloured background.',
        'Click "Remove background" and download the PNG files.',
      ],
      faq: [
        ['Are my photos sent to an AI service?', 'No. The model runs in your browser on your own device; the images never leave it.'],
        ['Which method should I use?', 'AI for photos of people, products and animals. Plain colour for logos, signatures and scans on white or a single-colour backdrop.'],
        ['Why is the result a PNG?', 'PNG keeps transparency, so the cut-out can be placed on any background.'],
      ],
    },
    pl: {
      name: 'Usuń tło',
      title: 'Usuń tło ze zdjęcia za darmo, bez wysyłania | Nyxiontech',
      description: 'Wytnij produkt, osobę lub logo i pobierz przezroczysty PNG. Model AI działa na Twoim urządzeniu; jest też tryb dla jednolitego tła. Za darmo.',
      h1: 'Usuń tło ze zdjęcia',
      intro: [
        'Zrób przezroczysty PNG z produktem, osobą albo logo. W przypadku zdjęć model AI (U²-Net) znajduje główny obiekt i działa w całości na Twoim urządzeniu; przy pierwszym użyciu model (około 5 MB) jest pobierany z tej strony. Najlepiej radzi sobie z jednym wyraźnym obiektem.',
        'Dla logo, skanów i zdjęć studyjnych tryb jednolitego koloru usuwa barwę wokół krawędzi (białą kartkę, tło studyjne) z regulowaną tolerancją. Tło możesz zostawić przezroczyste albo wypełnić wybranym kolorem.',
      ],
      steps: [
        'Upuść jedno lub kilka zdjęć (JPG, PNG, WebP lub HEIC).',
        'Wybierz „AI: photos” albo „Plain colour: logos, scans” oraz tło przezroczyste lub kolorowe.',
        'Kliknij „Remove background” i pobierz pliki PNG.',
      ],
      faq: [
        ['Czy zdjęcia trafiają do jakiejś usługi AI?', 'Nie. Model działa w przeglądarce na Twoim urządzeniu; zdjęcia go nie opuszczają.'],
        ['Którą metodę wybrać?', 'AI do zdjęć ludzi, produktów i zwierząt. Jednolity kolor do logo, podpisów i skanów na białym lub jednobarwnym tle.'],
        ['Dlaczego wynik jest w PNG?', 'PNG zachowuje przezroczystość, więc wycięty obiekt można położyć na dowolnym tle.'],
      ],
    },
  },

  'heic-to-jpg': {
    related: ['image-converter', 'images-to-pdf', 'remove-background', 'ocr'],
    en: {
      name: 'HEIC to JPG',
      title: 'HEIC to JPG free, no upload | Nyxiontech PDF Tools',
      description: 'Convert iPhone HEIC photos to JPG that opens everywhere, in bulk, right in your browser. Location data (EXIF) is removed. Free, no app, no upload.',
      h1: 'Convert HEIC to JPG',
      intro: [
        'iPhones save photos as HEIC, which many Windows programs, websites and forms will not open. Drop the photos here and get standard JPG files, as many at once as you like, downloaded one by one or as a zip.',
        'The photos are decoded in your browser, so nothing is uploaded and no app is installed. You can set the JPG quality, shrink large photos, or choose WebP or PNG instead. Location and camera data (EXIF) are removed.',
      ],
      steps: [
        'Drop your HEIC photos.',
        'Keep JPG, or adjust the quality and maximum size.',
        'Click "Convert" and download the JPG files or the zip.',
      ],
      faq: [
        ['Do I need to install anything?', 'No. The HEIC decoder runs in your browser.'],
        ['Is the photo location kept?', 'No. EXIF data, including GPS location, is removed from the converted images.'],
        ['Can I put the photos straight into a PDF?', 'Yes: use Image to PDF, which also accepts HEIC.'],
      ],
    },
    pl: {
      name: 'HEIC do JPG',
      title: 'HEIC do JPG za darmo, bez wysyłania | Nyxiontech',
      description: 'Zamień zdjęcia HEIC z iPhone’a na JPG, który otworzy się wszędzie, wiele naraz, w przeglądarce. Dane lokalizacji (EXIF) są usuwane. Za darmo.',
      h1: 'Zamień HEIC na JPG',
      intro: [
        'iPhone zapisuje zdjęcia w formacie HEIC, którego wiele programów w Windows, stron internetowych i formularzy nie otwiera. Upuść tu zdjęcia i dostaniesz zwykłe pliki JPG, dowolnie wiele naraz, do pobrania pojedynczo albo w archiwum zip.',
        'Zdjęcia są dekodowane w przeglądarce, więc nic nie jest wysyłane i niczego nie trzeba instalować. Możesz ustawić jakość JPG, zmniejszyć duże zdjęcia albo wybrać WebP lub PNG. Lokalizacja i dane aparatu (EXIF) są usuwane.',
      ],
      steps: [
        'Upuść zdjęcia HEIC.',
        'Zostaw JPG albo zmień jakość i maksymalny rozmiar.',
        'Kliknij „Convert” i pobierz pliki JPG albo archiwum zip.',
      ],
      faq: [
        ['Czy muszę coś instalować?', 'Nie. Dekoder HEIC działa w przeglądarce.'],
        ['Czy lokalizacja zdjęcia zostaje?', 'Nie. Dane EXIF, w tym lokalizacja GPS, są usuwane z przekonwertowanych zdjęć.'],
        ['Czy mogę od razu zrobić z nich PDF?', 'Tak: użyj konwersji JPG do PDF, która też przyjmuje pliki HEIC.'],
      ],
    },
  },

  qr: {
    related: ['image-converter', 'watermark', 'edit', 'remove-background'],
    en: {
      name: 'QR code generator',
      title: 'Free QR code generator, no tracking | Nyxiontech PDF Tools',
      description: 'Make QR codes for links, Wi-Fi, contact cards, e-mails or text and download them as PNG or SVG. Static codes: no tracking, no expiry, no sign-up.',
      h1: 'QR code generator',
      intro: [
        'Create a QR code for a link, a Wi-Fi network (guests join without typing the password), a contact card (vCard), a pre-filled e-mail or plain text. Choose the colours, the quiet zone and the error-correction level, and download it as a PNG of any size or as an SVG for print.',
        'The codes are static: the content is stored in the code itself, not behind a redirect. They never expire and nobody tracks who scans them.',
      ],
      steps: [
        'Choose the type: Link, Wi-Fi, Contact, E-mail or Text.',
        'Fill in the fields and adjust the style if you like.',
        'Download the code as PNG or SVG.',
      ],
      faq: [
        ['Do the QR codes expire?', 'No. They are static codes with the content inside, so they work as long as the content (e.g. the link) does.'],
        ['Are scans tracked?', 'No. There is no redirect service in between; scanning goes straight to your content.'],
        ['PNG or SVG?', 'PNG for screens and documents; SVG for print, because it scales to any size without blurring.'],
      ],
    },
    pl: {
      name: 'Generator kodów QR',
      title: 'Generator kodów QR za darmo, bez śledzenia | Nyxiontech',
      description: 'Twórz kody QR z linkiem, Wi-Fi, wizytówką, e-mailem lub tekstem i pobieraj je jako PNG lub SVG. Kody statyczne: bez śledzenia i bez wygasania.',
      h1: 'Generator kodów QR',
      intro: [
        'Stwórz kod QR z linkiem, siecią Wi-Fi (goście łączą się bez wpisywania hasła), wizytówką (vCard), gotowym e-mailem albo zwykłym tekstem. Wybierz kolory, margines i poziom korekcji błędów, a potem pobierz kod jako PNG w dowolnym rozmiarze albo jako SVG do druku.',
        'Kody są statyczne: treść jest zapisana w samym kodzie, a nie za przekierowaniem. Nigdy nie wygasają i nikt nie śledzi, kto je skanuje.',
      ],
      steps: [
        'Wybierz typ: Link, Wi-Fi, Contact, E-mail lub Text.',
        'Wypełnij pola i w razie potrzeby zmień wygląd.',
        'Pobierz kod jako PNG lub SVG.',
      ],
      faq: [
        ['Czy kody QR wygasają?', 'Nie. To kody statyczne z treścią w środku, więc działają tak długo, jak ich treść (np. link).'],
        ['Czy skanowania są śledzone?', 'Nie. Nie ma żadnej usługi przekierowań po drodze; skan prowadzi prosto do Twojej treści.'],
        ['PNG czy SVG?', 'PNG na ekran i do dokumentów; SVG do druku, bo skaluje się do dowolnego rozmiaru bez rozmycia.'],
      ],
    },
  },
};

/** Words shared by every page, per language. */
export const COMMON: Record<
  Lang,
  {
    home: string;
    howTo: string;
    faq: string;
    related: string;
    allTools: string;
    privacyQ: string;
    privacyA: (tool: string) => string;
    otherLanguage: string;
    source: string;
    footer: string;
  }
> = {
  en: {
    home: 'Nyxiontech PDF Tools',
    howTo: 'How to use it',
    faq: 'Questions',
    related: 'Related tools',
    allTools: 'All tools',
    privacyQ: 'Are my files uploaded?',
    privacyA: (tool) =>
      `No. ${tool} runs in your browser on your own device, so your files never leave it. It is free, with no account, no limits and no watermark, and the code is open source (AGPL-3.0).`,
    otherLanguage: 'Polski',
    source: 'Source code',
    footer: 'Free and open source. Files never leave your device.',
  },
  pl: {
    home: 'Narzędzia PDF Nyxiontech',
    howTo: 'Jak to zrobić',
    faq: 'Pytania',
    related: 'Podobne narzędzia',
    allTools: 'Wszystkie narzędzia',
    privacyQ: 'Czy moje pliki są gdzieś wysyłane?',
    privacyA: (tool) =>
      `Nie. Narzędzie „${tool}” działa w przeglądarce na Twoim urządzeniu, więc pliki go nie opuszczają. Jest bezpłatne, bez konta, limitów i znaku wodnego, a kod jest otwarty (AGPL-3.0).`,
    otherLanguage: 'English',
    source: 'Kod źródłowy',
    footer: 'Darmowe i otwartoźródłowe. Pliki nie opuszczają Twojego urządzenia.',
  },
};

/** The Polish home page (/pl/). The English home is index.html itself. */
export const HOME_PL = {
  title: 'Darmowe narzędzia PDF bez wysyłania plików | Nyxiontech',
  description:
    'Edytuj, podpisuj, łącz, dziel, kompresuj, OCR-uj i anonimizuj PDF w przeglądarce. Pliki nigdy nie są wysyłane. Za darmo, bez konta, open source.',
  h1: 'Narzędzia PDF Nyxiontech',
  intro: [
    'Darmowe narzędzia do PDF i zdjęć, które działają w całości w przeglądarce. Pliki nigdy nie są wysyłane na serwer: nie ma konta, śledzenia ani limitów. Projekt jest otwartoźródłowy (AGPL-3.0) i dostępny także jako aplikacja na Windows, która działa bez internetu.',
    'Interfejs aplikacji jest po angielsku, ale wszystkie narzędzia obsługują polskie znaki, a OCR rozpoznaje tekst po polsku.',
  ],
  faq: [
    ['Czy moje pliki są wysyłane?', 'Nie. Każde narzędzie działa w przeglądarce na Twoim urządzeniu, więc pliki go nie opuszczają. Nie ma konta ani śledzenia.'],
    ['Czy to jest darmowe?', 'Tak, bez limitów, rejestracji i znaków wodnych. Kod jest otwarty na licencji GNU AGPL v3.'],
    ['Czy jest aplikacja na komputer?', 'Tak, na Windows 10 i 11. Działa bez internetu i sama się aktualizuje podpisanymi aktualizacjami. Pobierzesz ją ze strony wydań na GitHubie.'],
  ] as [string, string][],
};
