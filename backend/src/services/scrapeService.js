import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";

const limit = pLimit(4);

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120000);
}

async function fetchOne(result) {
  /*
   * Validate the URL before attempting
   * a direct request.
   */
  let parsedUrl;

  try {
    parsedUrl = new URL(
      result.url
    );
  } catch {
    return {
      ...result,
      pageText:
        result.snippet || "",
      sourceMode:
        "indexed-snippet",
    };
  }

  /*
   * Only allow normal web protocols.
   */
  if (
    ![
      "http:",
      "https:",
    ].includes(
      parsedUrl.protocol
    )
  ) {
    return {
      ...result,
      pageText:
        result.snippet || "",
      sourceMode:
        "indexed-snippet",
    };
  }

  /*
   * Some sources, such as social-media
   * results, are intentionally not scraped
   * directly.
   */
  if (
    !result.directScrapeAllowed
  ) {
    return {
      ...result,
      pageText:
        result.snippet || "",
      sourceMode:
        "indexed-snippet",
    };
  }

  try {
    const response =
      await axios.get(
        result.url,
        {
          timeout:
            10000,

          maxContentLength:
            2_000_000,

          headers: {
            "User-Agent":
              "FootprintResearchPrototype/0.1",
          },

          validateStatus: (
            status
          ) =>
            status >= 200 &&
            status < 400,
        }
      );

    const contentType =
      String(
        response.headers[
          "content-type"
        ] || ""
      );

    /*
     * Only parse HTML pages.
     */
    if (
      !contentType.includes(
        "text/html"
      )
    ) {
      return {
        ...result,
        pageText:
          result.snippet || "",
        sourceMode:
          "indexed-snippet",
      };
    }

    const $ =
      cheerio.load(
        response.data
      );

    /*
     * Remove page elements that do not
     * contribute useful visible text.
     */
    $(
      "script,style,noscript,svg"
    ).remove();

    return {
      ...result,

      pageText:
        cleanText(
          `${$(
            "title"
          ).text()} ${$(
            "body"
          ).text()}`
        ),

      sourceMode:
        "scraped-page",
    };
  } catch {
    /*
     * If the page cannot be fetched,
     * keep the indexed search snippet
     * rather than failing the whole scan.
     */
    return {
      ...result,

      pageText:
        result.snippet || "",

      sourceMode:
        "indexed-snippet",
    };
  }
}

export async function retrievePages(
  results
) {
  return Promise.all(
    results.map(
      (result) =>
        limit(
          () =>
            fetchOne(
              result
            )
        )
    )
  );
}