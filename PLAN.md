# Tab Archaeologist — Refined Project Proposal & Implementation Plan

> **Project direction:** Preserve the original idea: a client-side browser extension that suggests topic/task-based groups for currently open tabs using locally processed tab metadata. The extension must remain non-destructive: it recommends groups but does not automatically move, close, rename, or otherwise modify tabs.

## 1. Project Details

| Field | Details |
|---|---|
| **Name** | Parthajeet Deva Sarmah |
| **Program & Branch** | M.Tech, CSE |
| **Semester** | 1 |
| **Roll No.** | 26CSM1R15 |
| **Project Title** | Tab Archaeologist |
| **Deployment Target** | Firefox and Chromium-based browsers |

## 2. Abstract

Tab Archaeologist is a client-side browser extension designed to reduce the effort involved in organizing large numbers of open browser tabs. It analyses tab metadata—primarily page titles, hostnames, and URL paths—locally in the browser and uses text similarity and clustering techniques to identify groups of potentially related tabs.

The extension follows a non-destructive approach. It presents suggested tab clusters with short, automatically generated labels and a brief explanation of why the tabs were grouped. It does not automatically rearrange or alter the user's tabs. All analysis is performed locally, without transmitting tab metadata to an external server.

The initial implementation will use text preprocessing, TF-IDF feature extraction, weighted cosine similarity, and agglomerative hierarchical clustering. The objective is to produce useful and explainable grouping suggestions while keeping the implementation lightweight, privacy-conscious, and feasible within the scope of the project.

## 3. Problem and Solution Statement

| Field | Description |
|---|---|
| **Problem** | Chronological tab opening and switching between tasks can leave users with a large, disorganized collection of tabs. Manually identifying related tabs requires repeated inspection and cleanup, while rearranging tabs without understanding their context can cause context loss. |
| **Proposed Solution** | On explicit user request, extract metadata from currently open tabs, process it locally, calculate pairwise similarity, and generate clusters of potentially related tabs. Display the clusters as suggestions with explanatory labels, leaving the final decision to the user. |
| **Core Principle** | Suggest, explain, and preserve user control. Do not automatically modify the user's tabs. |
| **Privacy Principle** | Process tab metadata locally. Do not send titles, URLs, or browsing data to external services. |

### 3.1 Product objectives

1. Retrieve metadata for tabs in the current browser window after the user activates the extension.
2. Identify topical similarities using page titles and URL paths, with hostname information used as a weaker signal.
3. Form groups without requiring the user to specify the number of groups in advance.
4. Generate understandable labels and simple explanations for each suggested group.
5. Present suggestions without automatically changing the browser's tab arrangement.
6. Keep the initial implementation small enough to support both Firefox and Chromium.

## 4. Scope of the Initial Version

The first version should concentrate on one complete workflow: **retrieve open tabs → analyse metadata → calculate similarity → cluster tabs → explain and display suggestions**.

| Area | Included in the initial version | Deferred or excluded |
|---|---|---|
| Tab input | Open tabs in the current window | Full browsing-history analysis; cross-device data |
| Metadata | Page title, hostname, URL path | Full webpage text, screenshots, DOM extraction |
| Processing | Local preprocessing and scoring | Cloud processing or external AI APIs |
| Features | TF-IDF vectors for title and path; hostname affinity | Embeddings, LLM classification, complex semantic models |
| Clustering | Agglomerative hierarchical clustering | User-specified number of clusters; complex online clustering |
| Labels | Keyword-based labels and representative page title | LLM-generated summaries |
| Interface | Popup displaying suggested clusters and their tabs | Full dashboard or browser-side task manager |
| User control | View, dismiss, and optionally rename suggestions; navigate to a tab | Automatic tab movement, closing, or reordering |
| Runtime | User-triggered analysis | Continuous or real-time background clustering |

**Scope safeguard:** Do not add a feature merely because it is possible. It should be included only if it directly improves the quality, explanation, or usability of the core clustering workflow.

## 5. Execution Pipeline

The original execution pipeline is retained and extended only where a stage is required to turn similarity scores into useful tab groups.

| Stage | Action | Technical function | Expected output |
|---|---|---|---|
| **1. Trigger** | User clicks the extension button | Retrieve metadata for open tabs in the current window | List of tab records |
| **2. Cleaning** | Extract and normalize parameters | Parse titles, hostnames, and URL paths; remove query parameters and fragments; normalize text | Clean metadata records |
| **3. Feature Extraction** | Tokenize text strings | Lowercase, split terms, remove stop words, and construct TF-IDF vectors | Title and path feature vectors |
| **4. Similarity Scoring** | Calculate pairwise similarity | Combine title similarity, path similarity, and hostname affinity into a weighted similarity score | Symmetric similarity matrix |
| **5. Clustering** | Group related tabs | Apply agglomerative hierarchical clustering with average linkage and a similarity stopping threshold | Suggested tab clusters |
| **6. Label Generation** | Describe the suggested groups | Extract high-weight terms and choose a representative tab title | Cluster labels and explanations |
| **7. Presentation** | Show suggestions to the user | Display groups, included tabs, and reasons for grouping | Non-destructive popup interface |
| **8. Evaluation** | Check grouping quality | Compare predictions against manually labelled browsing sessions | Precision, recall, F1-score, and qualitative observations |

### 5.1 Pipeline flow

```text
User clicks extension button
            |
            v
Retrieve open-tab metadata
            |
            v
Normalize title, hostname, and URL path
            |
            v
Tokenize and remove selected stop words
            |
            v
Build separate TF-IDF representations
            |
            v
Calculate pairwise weighted similarity
            |
            v
Create similarity matrix
            |
            v
Agglomerative hierarchical clustering
            |
            v
Generate cluster labels and explanations
            |
            v
Display suggested groups to the user
            |
            v
User reviews suggestions (tabs remain unchanged)
```

## 6. Metadata Extraction and Preprocessing

### 6.1 Metadata model

Each eligible tab can be represented using a small record:

```ts
interface TabDocument {
    id: number;
    title: string;
    hostname: string;
    path: string;
}
```

The browser tab ID is retained so that a displayed result can refer to the original tab. The clustering engine itself should operate on normalized text features rather than depending on browser-specific tab objects.

### 6.2 Data sources

The initial implementation uses only:

- **Title:** The page title, which is often the strongest available description of the page's topic.
- **Hostname:** The domain hosting the page, used as a weak contextual signal.
- **Path:** The URL path, which can contain useful topic or resource information.

For example:

```text
Original URL:
https://example.com/articles/linux?ref=123#section

Extracted fields:
hostname = example.com
path     = articles/linux
```

Query parameters and fragments should be removed because they often contain tracking values, session identifiers, or page-specific state rather than useful topical information.

### 6.3 Normalization rules

Apply a consistent preprocessing pipeline:

1. Convert text to lowercase.
2. Remove URL query parameters and fragments.
3. Split URL paths into individual components.
4. Split hyphenated, underscored, and camelCase terms where practical.
5. Remove punctuation and irrelevant symbols while preserving meaningful technical terms.
6. Remove common stop words such as `the`, `and`, `for`, and `with`.
7. Remove clearly non-topical path segments or identifiers where practical, such as long numeric IDs and UUID-like values.
8. Treat empty titles or paths safely rather than failing the complete analysis.

Do not use an indiscriminate stop-word list. Technical terms such as `C++`, `C`, `OS`, `API`, `SQL`, and `CPU` may be meaningful and should not be removed simply because they are short or unusual.

### 6.4 Separate feature channels

Keep title tokens and path tokens separate. This makes it possible to weight them independently and inspect which source contributed to a similarity score.

For example:

```text
Title: Linux Kernel Memory Management
Title tokens: [linux, kernel, memory, management]

Path: /doc/html/mm
Path tokens: [doc, html, mm]
```

The hostname should initially be handled as a separate affinity feature rather than tokenized as ordinary text. Otherwise, common domains can overwhelm topical information.

## 7. Feature Extraction Using TF-IDF

TF-IDF (Term Frequency–Inverse Document Frequency) is used to assign greater importance to terms that are useful for distinguishing tabs in the current collection.

For a token `t`:

\[
IDF(t) = \ln\left(\frac{N+1}{DF(t)+1}\right)+1
\]

Where:

- `N` is the number of eligible open tabs being analysed.
- `DF(t)` is the number of tab documents containing token `t`.

A simple term-frequency calculation can be used initially. The TF-IDF representation is calculated separately for title tokens and path tokens.

### Why TF-IDF?

A term that appears in many open tabs may be too generic to distinguish topics. A term that appears in only a few tabs may be more informative. TF-IDF reduces the relative influence of common terms and increases the influence of more distinctive terms.

For the first version, implement TF-IDF directly in TypeScript. A separate NLP library is not necessary for this limited vocabulary and metadata workload.

## 8. Similarity Scoring

### 8.1 Cosine similarity

Use cosine similarity to compare two TF-IDF vectors:

\[
\operatorname{cos}(A,B)=
\frac{A\cdot B}{\|A\|\|B\|}
\]

The value is generally between 0 and 1 for non-negative TF-IDF vectors. A higher value indicates greater similarity between the two feature representations.

Calculate:

- `T(i,j)`: cosine similarity between the title vectors of tabs `i` and `j`.
- `P(i,j)`: cosine similarity between the path vectors of tabs `i` and `j`.
- `H(i,j)`: hostname affinity for tabs `i` and `j`.

### 8.2 Hostname affinity

For the MVP, use a simple hostname match:

\[
H(i,j)=
\begin{cases}
1 & \text{if the normalized hostnames are identical}\\
0 & \text{otherwise}
\end{cases}
\]

This is deliberately a weak signal. Two pages from the same website can cover unrelated subjects, so hostname equality must not dominate the score.

### 8.3 Weighted combined score

Start with the following experimental weighting:

\[
\boxed{S(i,j)=0.65T(i,j)+0.25P(i,j)+0.10H(i,j)}
\]

These values are starting parameters for experimentation, not established optimal weights. Title similarity receives the greatest weight because titles usually communicate the page topic most directly. Path similarity provides supporting context, while hostname affinity has the smallest weight.

If one of the text fields is missing or has no usable tokens, redistribute its weight proportionally across the remaining available signals for that pair. Do not allow missing data to automatically imply zero similarity for the entire pair.

### 8.4 Similarity matrix

For `N` tabs, calculate an `N × N` matrix:

\[
M_{ij}=S(i,j)
\]

The matrix should be symmetric, with a diagonal value of 1 for each tab compared with itself. The matrix provides the input to the clustering stage.

**Illustrative example only:**

| | Kernel memory | Slab allocators | Linux slab | React docs | useEffect |
|---|---:|---:|---:|---:|---:|
| Kernel memory | 1.00 | 0.72 | 0.81 | 0.04 | 0.06 |
| Slab allocators | 0.72 | 1.00 | 0.76 | 0.03 | 0.05 |
| Linux slab | 0.81 | 0.76 | 1.00 | 0.02 | 0.04 |
| React docs | 0.04 | 0.03 | 0.02 | 1.00 | 0.68 |
| useEffect | 0.06 | 0.05 | 0.04 | 0.68 | 1.00 |

The values above are hypothetical and are included to demonstrate the expected shape of the matrix, not to claim measured performance.

## 9. Clustering Algorithm

### 9.1 Recommended method: agglomerative hierarchical clustering

Use agglomerative hierarchical clustering with **average linkage**. It is suitable for the initial project because the number of task groups is not known beforehand and does not need to be provided by the user.

Initially, every tab is its own cluster. At each step, the algorithm merges the two clusters with the highest average pairwise similarity, provided that the similarity meets the configured stopping threshold.

For clusters `A` and `B`:

\[
S(A,B)=\frac{1}{|A||B|}
\sum_{i\in A}\sum_{j\in B}S(i,j)
\]

Where:

- `A` and `B` are two candidate clusters.
- `|A|` and `|B|` are their respective numbers of tabs.
- `S(i,j)` is the previously calculated similarity between tabs `i` and `j`.

### 9.2 Example

Suppose the input contains:

```text
A = Linux Kernel Memory
B = Slab Allocators
C = Linux Slab Implementation
D = React Documentation
E = React Hooks
F = Python Tutorial
```

Initially:

```text
{A} {B} {C} {D} {E} {F}
```

After the highest-similarity pairs are merged:

```text
{A, C} {B} {D} {E} {F}
```

Then:

```text
{A, B, C} {D} {E} {F}
```

And eventually:

```text
{A, B, C} {D, E} {F}
```

Tabs that do not form a sufficiently strong group remain unclustered rather than being forced into an unrelated group.

### 9.3 Similarity threshold

Use a configurable similarity threshold to decide when to stop merging. A value around `0.35` can be used as an initial experimental setting, but it must be tuned using manually labelled browsing sessions. TF-IDF similarity values depend on the dataset, vocabulary, and preprocessing choices; therefore, no universal threshold should be assumed.

The first version should also enforce a minimum suggested cluster size of two. Single tabs can remain in an **Unclustered** or **Other tabs** section.

### 9.4 Why average linkage?

Average linkage compares the average similarity between all members of two candidate clusters. It helps reduce the chaining issue that can occur with simple threshold-based connected components.

For example, if `A` is similar to `B`, and `B` is similar to `C`, but `A` and `C` are very dissimilar, connected components can still place all three together. Average linkage considers the overall relationship between the candidate groups rather than relying on one connecting pair.

### 9.5 Why not K-means initially?

K-means generally requires the number of clusters to be specified in advance. The number of actual browsing tasks is unknown, so requiring that input would be inconvenient for the intended workflow.

### 9.6 Complexity considerations

A straightforward hierarchical implementation can require approximately `O(N^3)` time and `O(N^2)` space for a similarity matrix, depending on the implementation. This is an acceptable starting point for the expected scale of a typical open-tab collection. Optimization should be considered only if measurements show that the initial implementation is too slow for realistic tab counts.

## 10. Cluster Labels and Explanations

The extension should make its results understandable rather than displaying unexplained groups.

### 10.1 Keyword-based labels

For each cluster:

1. Aggregate the TF-IDF weights of terms from its member tabs.
2. Identify the highest-weight useful terms.
3. Generate a short label from two or three representative terms.
4. If the keywords are weak or unhelpful, use the title of a representative tab as a fallback.

Example:

```text
Cluster tabs:
- Linux Kernel Memory Management
- Understanding Slab Allocators
- Slab Allocation in Linux

Representative terms:
linux, slab, memory, kernel

Suggested label:
Linux · Memory Management
```

### 10.2 Representative tab

A representative tab can be selected as the tab with the greatest average similarity to the other tabs in its cluster (the cluster medoid). Its title can provide a fallback label when the aggregated terms are not sufficiently meaningful.

### 10.3 Explanation shown to the user

Each group should include a brief explanation, such as:

> Grouped because the tabs share the terms “Linux”, “slab”, and “memory”, and have relatively high average title similarity.

The interface may show an average within-cluster similarity as an indication of grouping strength. It must not describe that value as a probability or as a calibrated confidence score.

## 11. User Interface and Interaction

The MVP should use a conventional extension popup. The interface can display:

- A button to analyse the currently open tabs.
- Suggested cluster names.
- The tabs included in each cluster.
- A short explanation of the shared terms or similarity signals.
- An indication of grouping strength, if useful.
- A way to open or switch to an individual tab.
- A way to dismiss a suggestion or optionally rename its displayed label.
- An **Unclustered** section for tabs that do not meet the grouping threshold.

The extension should not automatically move, reorder, close, or rename browser tabs. Any future tab-management action should require an explicit user action and should be treated as a separate feature from the clustering engine.

## 12. Technical Architecture

Use TypeScript, HTML, and CSS with the browser's WebExtension APIs. Keep browser-specific functionality isolated from the clustering logic so the analysis code can be shared between Chromium and Firefox.

### 12.1 Suggested project structure

```text
tab-archaeologist/
│
├── manifest.json
│
├── popup/
│   ├── popup.html
│   ├── popup.ts
│   └── popup.css
│
├── browser/
│   └── adapter.ts
│
├── core/
│   ├── extractor.ts
│   ├── normalizer.ts
│   ├── tokenizer.ts
│   ├── tfidf.ts
│   ├── similarity.ts
│   ├── clustering.ts
│   └── labeling.ts
│
└── types/
    └── tab.ts
```

### 12.2 Responsibilities

| Module | Responsibility |
|---|---|
| `browser/adapter.ts` | Encapsulate browser API calls and tab retrieval |
| `core/extractor.ts` | Convert browser tab objects into the project's metadata model |
| `core/normalizer.ts` | Clean titles, hostnames, and paths |
| `core/tokenizer.ts` | Split text into useful tokens and apply stop-word filtering |
| `core/tfidf.ts` | Build title and path TF-IDF vectors |
| `core/similarity.ts` | Calculate cosine similarity and the combined pairwise score |
| `core/clustering.ts` | Build clusters using average-linkage agglomerative clustering |
| `core/labeling.ts` | Produce representative terms, labels, and explanations |
| `popup/` | Trigger analysis and render the suggested groups |

### 12.3 Processing flow

The popup or extension runtime requests the current window's tabs through the browser adapter. The adapter returns the required metadata to the shared core modules. The core modules perform preprocessing, feature extraction, scoring, clustering, and labeling. The popup displays the resulting suggestions.

The clustering engine should not import browser APIs. This separation makes it easier to test the algorithm independently and reuse it across browsers.

### 12.4 Browser permissions and compatibility

The extension needs permission to retrieve tab metadata such as titles and URLs. Use the minimum permissions required by the chosen browser APIs, and explain the permission clearly to users. A `tabs` permission may be needed to access sensitive tab properties such as `title` and `url`; exact permission behavior should be verified against the target browser versions during implementation.

Keep the UI based on a standard popup for the initial release. Browser-specific sidebar or side-panel experiences can be considered later because their APIs differ between Chromium and Firefox.

## 13. Privacy and Security Considerations

Privacy is part of the product concept, not an optional enhancement.

1. Perform all metadata processing locally in the browser.
2. Do not transmit tab titles, URLs, hostnames, or derived browsing data to external servers.
3. Do not inject content scripts or extract full page content in the MVP.
4. Run analysis only after an explicit user action.
5. Avoid storing browsing data persistently. Store only basic user preferences locally if needed.
6. Do not include tab metadata in analytics or diagnostic logs.
7. Handle restricted browser pages and inaccessible tabs gracefully; skip them or report that they could not be analysed.
8. Make the required browser permissions clear in the extension interface or documentation.

## 14. Evaluation Methodology

A clustering algorithm should be evaluated against known examples rather than judged only by visual inspection.

### 14.1 Build a small labelled dataset

Prepare approximately 8–10 manually labelled browsing sessions, with roughly 10–20 tabs per session where practical. Each tab should be assigned a ground-truth task/topic label by the person preparing the session.

Example:

```text
Session 1

Task A: Linux memory management
    Tab 1
    Tab 2
    Tab 3

Task B: React development
    Tab 4
    Tab 5

Task C: Database preparation
    Tab 6
    Tab 7
```

Use realistic mixes of tabs, including:

- Multiple pages from the same domain that cover different subjects.
- Similar topics from different domains.
- Generic or uninformative page titles.
- Tabs with missing or short URL paths.
- A few unrelated tabs that should remain unclustered.

Avoid tuning and evaluating on exactly the same examples without noting the limitation. Where feasible, reserve some sessions for evaluation after tuning the weights and threshold.

### 14.2 Pairwise precision and recall

For every pair of tabs, compare whether the system placed them in the same cluster with whether their ground-truth labels match.

\[
Precision=\frac{TP}{TP+FP}
\]

\[
Recall=\frac{TP}{TP+FN}
\]

\[
F1=2\times\frac{Precision\times Recall}{Precision+Recall}
\]

Where:

- **TP:** A pair of tabs belongs to the same ground-truth task and is placed in the same predicted cluster.
- **FP:** A pair belongs to different ground-truth tasks but is placed in the same predicted cluster.
- **FN:** A pair belongs to the same ground-truth task but is placed in different predicted clusters.

For this application, prioritize precision initially. Grouping unrelated tabs together can reduce user trust, while leaving a few related tabs ungrouped is generally less disruptive.

An initial engineering target could be **80% pairwise precision** on the labelled evaluation sessions. This is a target to test and improve, not a result to claim before measurement. Recall and F1 should still be reported so that overly conservative clustering is visible.

### 14.3 Compare against simple baselines

Evaluate at least these approaches on the same sessions:

| Method | Purpose |
|---|---|
| Same-hostname grouping | Simple baseline to show the limitations of domain-only grouping |
| Title-only TF-IDF | Measures the contribution of page-title text |
| Weighted title/path/hostname similarity with hierarchical clustering | Evaluates the proposed method |

This comparison helps establish whether the additional path and hostname signals improve the results.

### 14.4 Additional observations

Record:

- Number of clusters generated per session.
- Number and percentage of tabs left unclustered.
- Average within-cluster similarity.
- Processing time for different tab counts.
- Common failure cases, such as generic titles or unrelated pages from the same host.

Do not report only a single aggregate score. Include representative successful and unsuccessful examples and explain what caused the failures.

## 15. Implementation Plan

| Phase | Work | Completion criterion |
|---|---|---|
| **1. Browser integration** | Create the extension and retrieve current-window tab metadata | Display tab titles and URLs in the popup |
| **2. Preprocessing** | Implement URL parsing, normalization, tokenization, and stop-word filtering | Inspect and verify normalized records and tokens |
| **3. TF-IDF and similarity** | Build field-specific TF-IDF vectors, cosine similarity, hostname affinity, and the combined score | Generate a symmetric similarity matrix for sample tabs |
| **4. Clustering** | Implement average-linkage agglomerative clustering and a configurable stopping threshold | Produce clusters and leave weakly related tabs unclustered |
| **5. Labels and explanations** | Aggregate representative terms and select a representative tab | Display understandable labels and reasons for grouping |
| **6. Popup interface** | Render suggestions and provide basic review interactions | User can inspect groups and open a selected tab without automatic changes |
| **7. Evaluation and compatibility** | Test labelled sessions, tune parameters, and verify Firefox support | Report evaluation metrics and demonstrate both browser targets |

Implement Chromium support first to reduce initial integration work, but keep browser API calls behind the adapter so Firefox support does not require rewriting the core algorithm.

## 16. Risks and Mitigations

| Risk | Why it matters | Initial mitigation |
|---|---|---|
| Generic or missing page titles | Weak text features produce poor similarity | Fall back to path features and leave uncertain tabs unclustered |
| Many tabs from one domain | Hostname-only grouping can combine unrelated subjects | Keep hostname affinity low-weighted |
| Similar topics across different sites | Domain information alone may miss useful relationships | Give title similarity the greatest weight |
| Chaining between weakly related tabs | Threshold-connected components can create broad, incoherent groups | Use average-linkage hierarchical clustering |
| Threshold does not generalize | Similarity distributions vary across sessions | Tune using labelled sessions and report the chosen value |
| Browser API differences | Could create duplicated implementation work | Isolate browser calls in an adapter module |
| Sensitive browsing metadata | Could undermine the privacy promise | Local-only processing, minimal permissions, no metadata telemetry |
| Excessive feature expansion | Could make the project difficult to complete and evaluate | Keep the first version restricted to the stated MVP |

## 17. Expected Deliverables

1. A working Chromium browser extension that retrieves and analyses current-window tabs.
2. A reusable TypeScript preprocessing and feature-extraction pipeline.
3. A similarity engine that generates weighted pairwise scores.
4. An agglomerative hierarchical clustering implementation.
5. A cluster-label and explanation generator.
6. A non-destructive popup interface for reviewing suggested groups.
7. A Firefox-compatible build using the shared core logic.
8. A manually labelled evaluation dataset and a report containing precision, recall, F1-score, processing time, baselines, and failure-case analysis.
9. Project documentation describing the architecture, algorithm, privacy approach, and limitations.

## 18. Final Design Decisions

The initial project will use the following concrete decisions:

| Design area | Initial decision |
|---|---|
| Trigger | Explicit user click |
| Tab scope | Current browser window |
| Metadata | Title, hostname, URL path |
| Text representation | Separate TF-IDF vectors for titles and paths |
| Similarity | Weighted cosine similarity plus hostname affinity |
| Initial weights | 0.65 title, 0.25 path, 0.10 hostname |
| Clustering | Agglomerative hierarchical clustering, average linkage |
| Stopping rule | Configurable similarity threshold, tuned on labelled sessions |
| Minimum cluster size | Two tabs |
| Labels | Top-weighted cluster terms, with representative-title fallback |
| Explanation | Shared terms and average within-cluster similarity |
| Processing | Local and user-initiated |
| UI | Standard browser popup |
| Tab operations | Suggestions only; no automatic tab modification |
| Evaluation | Pairwise precision, recall, F1, baselines, runtime and error analysis |

## 19. Conclusion

Tab Archaeologist will focus on a narrow but useful problem: identifying potentially related open tabs and presenting those relationships as explainable, non-destructive suggestions. The project does not require a large language model or a complex semantic-search system to establish a meaningful baseline. A carefully implemented pipeline based on metadata normalization, TF-IDF, weighted cosine similarity, and hierarchical clustering is sufficient for a substantive first version.

The main research and engineering effort should be spent on feature quality, similarity weighting, threshold selection, handling ambiguous tabs, and evaluating cluster quality on realistic browsing sessions. This keeps the project aligned with the original proposal while making the implementation measurable, technically defensible, privacy-conscious, and achievable.
