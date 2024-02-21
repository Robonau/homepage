import { useTranslation } from "next-i18next";

import Container from "components/services/widget/container";
import Block from "components/services/widget/block";
import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();

  const { widget } = service;

  const { data: suwayomiData, error: suwayomiError } = useWidgetAPI(widget);

  if (suwayomiError) {
    return <Container service={service} error={suwayomiError} />;
  }

  console.log(suwayomiData);

  if (!suwayomiData) {
    return (
      <Container service={service}>
        <Block label="suwayomi.readCount" />
        <Block label="suwayomi.downloadCount" />
        <Block label="suwayomi.downloadedUnread" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      {suwayomiData.readCount ? (
        <Block label="suwayomi.readCount" value={t("common.number", { value: suwayomiData.readCount })} />
      ) : null}
      {suwayomiData.downloadCount ? (
        <Block label="suwayomi.downloadCount" value={t("common.number", { value: suwayomiData.downloadCount })} />
      ) : null}
      {suwayomiData.downloadedUnread ? (
        <Block label="suwayomi.downloadedUnread" value={t("common.number", { value: suwayomiData.downloadedUnread })} />
      ) : null}
    </Container>
  );
}
