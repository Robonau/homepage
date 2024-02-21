import { httpProxy } from "utils/proxy/http";
import { formatApiCall } from "utils/proxy/api-helpers";
import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import widgets from "widgets/widgets";

const proxyName = "suwayomiProxyHandler";
const logger = createLogger(proxyName);

export default async function suwayomiProxyHandler(req, res) {
  const { group, service, endpoint } = req.query;

  if (!group || !service) {
    logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getServiceWidget(group, service);

  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const url = new URL(formatApiCall(widgets[widget.type].api, { endpoint, ...widget }));

  let body = "";
  // .isNaN() was crashing the server idk why
  const isNaN = !(Number(widget.category) <= 0 || Number(widget.category) >= 0);
  if (widget.category === undefined || isNaN) {
    body = JSON.stringify({
      operationName: "mangas",
      query: `
      query mangas {
      mangas(condition: {inLibrary: true}) {
        nodes {
          chapters {
            nodes {
              isDownloaded
              isRead
            }
          }
        }
      }
    }`,
    });
  } else {
    body = JSON.stringify({
      operationName: "category",
      query: `
      query category($id: Int!) {
        category(id: $id) {
          mangas {
            nodes {
              title
              chapters {
                nodes {
                  isRead
                  isDownloaded
                }
              }
            }
          }
        }
      }`,
      variables: {
        id: widget.category ?? 0,
      },
    });
  }

  const auth =
    widget.username && widget.password
      ? `Basic ${Buffer.from(`${widget.username}:${widget.password}`).toString("base64")}`
      : null;

  const [status, contentType, data] = await httpProxy(url, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      Authorization: auth,
    },
  });

  if (status !== 200) {
    logger.error("Error getting data from Suwayomi: %d.  Data: %s", status, data);
    return res.status(500).send({ error: { message: "Error getting data from Suwayomi", url, data } });
  }

  const jsn = JSON.parse(data.toString());
  const returnData = {};
  let count = 0;

  if ((widget.readCount === undefined || widget.readCount) && count <= 4) {
    count += 1;
    returnData.readCount = (jsn.data.category?.mangas.nodes ?? jsn.data.mangas.nodes).reduce(
      (aa, cc) =>
        cc.chapters.nodes.reduce((a, c) => {
          if (c.isRead) {
            return a + 1;
          }
          return a;
        }, 0) + aa,
      0,
    );
  }

  if ((widget.downloadCount === undefined || widget.downloadCount) && count <= 4) {
    count += 1;
    returnData.downloadCount = (jsn.data.category?.mangas.nodes ?? jsn.data.mangas.nodes).reduce(
      (aa, cc) =>
        cc.chapters.nodes.reduce((a, c) => {
          if (c.isDownloaded) {
            return a + 1;
          }
          return a;
        }, 0) + aa,
      0,
    );
  }

  if ((widget.downloadedUnread === undefined || widget.downloadedUnread) && count <= 4) {
    count += 1;
    returnData.downloadedUnread = (jsn.data.category?.mangas.nodes ?? jsn.data.mangas.nodes).reduce(
      (aa, cc) =>
        cc.chapters.nodes.reduce((a, c) => {
          if (c.isDownloaded && !c.isRead) {
            return a + 1;
          }
          return a;
        }, 0) + aa,
      0,
    );
  }

  if (contentType) res.setHeader("Content-Type", contentType);
  return res.status(status).send(returnData);
}
