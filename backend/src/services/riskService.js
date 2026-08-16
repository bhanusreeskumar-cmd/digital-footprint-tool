function calculateEi(matched) {
  const distinctIdentifiers = new Set(
    matched.map((item) => {
      const type = item.type || "";

      const value = String(
        item.value || ""
      )
        .trim()
        .toLowerCase();

      return `${type}:${value}`;
    })
  );

  const count =
    distinctIdentifiers.size;

  if (count >= 3) {
    return 1;
  }

  if (count === 2) {
    return 0.75;
  }

  if (count === 1) {
    return 0.5;
  }

  return 0.25;
}

function riskLevel(severity) {
  if (severity < 2) {
    return "Low";
  }

  if (severity < 3) {
    return "Medium";
  }

  if (severity < 4) {
    return "High";
  }

  return "Very High";
}

function getReadableLabel(type) {
  const labels = {
    fullName: "name",
    email: "email address",
    phone: "phone number",
    referencePhoto: "photograph",
  };

  return labels[type] || type;
}

function getIdentifierDescription(matched) {
  const labels = matched.map((item) =>
    getReadableLabel(item.type)
  );

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels
    .slice(0, -1)
    .join(", ")} and ${
    labels[labels.length - 1]
  }`;
}

function getIdentificationExplanation(
  matched,
  ei
) {
  if (matched.length === 1) {
    const label =
      getReadableLabel(
        matched[0].type
      );

    return `A ${label} can contribute to identifying an individual, particularly when combined with other publicly available information.`;
  }

  if (ei === 1) {
    return "Several distinct identifiers appear together, making the finding highly identifying.";
  }

  if (ei === 0.75) {
    return "Two distinct identifiers appear together, making the finding more strongly identifying than either one alone.";
  }

  return "The identifiers in this finding contribute to identifying an individual.";
}

export function scoreFinding(
  detection,
  sourceRule
) {
  const dpc = Math.max(
    1,
    sourceRule.dpcFloor
  );

  const ei =
    calculateEi(
      detection.matched
    );

  const sourceReach =
    sourceRule.reach;

  const aggregatorAdjustment =
    sourceRule.exploitativeAggregator
      ? 0.5
      : 0;

  const cb =
    sourceReach +
    aggregatorAdjustment;

  const severity = Number(
    (
      dpc * ei +
      cb
    ).toFixed(2)
  );

  const level =
    riskLevel(severity);

  const identifierDescription =
    getIdentifierDescription(
      detection.matched
    );

  const identificationExplanation =
    getIdentificationExplanation(
      detection.matched,
      ei
    );

  const distinctIdentifierCount =
    new Set(
      detection.matched.map(
        (item) =>
          `${item.type}:${String(
            item.value || ""
          )
            .trim()
            .toLowerCase()}`
      )
    ).size;

  return {
    dpc,
    ei,
    cb,
    severity,
    level,

    reason:
      `${
        identifierDescription ||
        "Personal information"
      } was found. ` +
      `${sourceRule.reason} ` +
      identificationExplanation,

    explanation:
      `DPC ${dpc}: source/data context. ` +
      `EI ${ei}: ease of identification from ${distinctIdentifierCount} distinct matched identifier(s). ` +
      `CB ${cb}: source reach ${sourceReach}` +
      `${
        aggregatorAdjustment
          ? " + 0.5 exploitative-aggregator adjustment"
          : ""
      }.`,

    recommendedAction:
      level === "Very High" ||
      level === "High"
        ? "Review this source first and consider preparing a removal request if the information is unwanted."
        : level === "Medium"
        ? "Review the context and consider removal if the information is unnecessary or unexpected."
        : "Keep under review; removal may still be appropriate if you did not expect this information to be public.",
  };
}