# Third-party notices

このファイルは lightweight-ir-modeler が利用する第三者ソフトウェアの著作権表示と許諾文です。
本プロジェクト自身のライセンスは [LICENSE](./LICENSE)（MIT）です。

第三者パッケージが ISC など別ライセンスであっても、本リポジトリの自作ソースのライセンスは MIT のままです。

SvelteKit は `static/` をクライアント成果物へコピーします。同じ内容を `static/THIRD_PARTY_NOTICES.md` と `static/LICENSE` にも置きます。

## 直接依存（package.json dependencies）

| パッケージ | SPDX |
|---|---|
| yaml | ISC |
| handlebars | MIT |
| winston | MIT |
| @depup/winston-daily-rotate-file | MIT |
| monaco-editor | MIT |
| nanoid | MIT |
| zod | MIT |
| fast-xml-parser | MIT |
| @types/handlebars | MIT |

## 本番グラフで MIT 以外の間接依存

| パッケージ | SPDX | 由来 |
|---|---|---|
| inherits | ISC | winston 等 |
| source-map | BSD-3-Clause | handlebars |
| uglify-js | BSD-2-Clause | handlebars（optional） |

## クライアントにバンドルされうる UI（devDependencies でも成果物に入りうる）

| パッケージ | SPDX | 著作権表示 |
|---|---|---|
| monaco-editor | MIT | Copyright (c) 2016 - present Microsoft Corporation |
| svelte | MIT | Copyright (c) 2016-2025 Svelte Contributors |
| flowbite | MIT | Copyright (c) 2023 Bergside Inc. |
| flowbite-svelte | MIT | Copyright (c) 2022 Flowbite Svelte (created by Shinichi Okada) |
| flowbite-svelte-icons | MIT | Shinichi Okada（package.json author。LICENSE のプレースホルダは未置換） |
| svelte-dnd-action | MIT | Copyright (c) 2020 Isaac Hagoel |
| nanoid | MIT | Copyright 2017 Andrey Sitnik <andrey@sitnik.es> |

---

## yaml (ISC)

Copyright Eemeli Aro <eemeli@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

---

## inherits (ISC)

The ISC License

Copyright (c) Isaac Z. Schlueter

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

---

## source-map (BSD-3-Clause)


Copyright (c) 2009-2011, Mozilla Foundation and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

---

## uglify-js (BSD-2-Clause)

UglifyJS is released under the BSD license:

Copyright 2012-2024 (c) Mihai Bazon <mihai.bazon@gmail.com>

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

    * Redistributions of source code must retain the above
      copyright notice, this list of conditions and the following
      disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.

---

## MIT パッケージ

次の著作権表示が、下記 MIT 許諾文とともに適用されます。

- handlebars — Copyright (C) 2011-2019 by Yehuda Katz
- winston — Copyright (c) 2010 Charlie Robbins
- @depup/winston-daily-rotate-file — Copyright (c) 2015-2024 winstonjs
- monaco-editor — Copyright (c) 2016 - present Microsoft Corporation
- nanoid — Copyright 2017 Andrey Sitnik <andrey@sitnik.es>
- zod — Copyright (c) 2025 Colin McDonnell
- fast-xml-parser — Copyright (c) 2017 Amit Kumar Gupta
- @types/handlebars — Copyright (c) Microsoft Corporation. All rights reserved.
- svelte — Copyright (c) 2016-2025 Svelte Contributors
- flowbite — Copyright (c) 2023 Bergside Inc.
- flowbite-svelte — Copyright (c) 2022 Flowbite Svelte (created by Shinichi Okada)
- svelte-dnd-action — Copyright (c) 2020 Isaac Hagoel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
