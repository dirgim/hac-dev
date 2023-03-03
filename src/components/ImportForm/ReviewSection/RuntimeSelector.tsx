import * as React from 'react';
import { DropdownToggle, Spinner, Text } from '@patternfly/react-core';
import { useFormikContext } from 'formik';
import { DropdownField } from '../../../shared';
import { useComponentDetection } from '../utils/cdq-utils';
import { transformComponentValues } from '../utils/transform-utils';
import { ImportFormValues } from '../utils/types';
import { useDevfileSamples } from '../utils/useDevfileSamples';

type RuntimeSelectorProps = {
  detectedComponentIndex: number;
};

const patchSourceUrl = (stub: any, url: string) => {
  return {
    ...stub,
    source: {
      git: {
        ...stub.source.git,
        url,
      },
    },
  };
};

export const RuntimeSelector: React.FC<RuntimeSelectorProps> = ({ detectedComponentIndex }) => {
  const fieldPrefix = `components[${detectedComponentIndex}]`;
  const {
    values: {
      secret,
      application,
      source: {
        git: { url: sourceUrl, revision, context },
      },
      isDetected,
      components,
    },
    setFieldValue,
    setFieldError,
    setFieldTouched,
  } = useFormikContext<ImportFormValues>();
  const [samples, samplesLoaded] = useDevfileSamples();
  const [detecting, setDetecting] = React.useState(false);
  const [runtimeSource, setRuntimeSource] = React.useState('');
  const [selectedRuntime, setSelectedRuntime] = React.useState(null);

  const DetectingRuntime = 'Detecting runtime...';
  const items = React.useMemo(() => {
    return (
      samples?.map((s) => ({ key: s.uid, value: s.name, icon: <img src={s.icon.url} /> })) || []
    );
  }, [samples]);

  const onChange = (value: string) => {
    const runtime = samples.find((s) => s.name === value);
    if (
      (runtime.attributes?.git as any)?.remotes?.origin ===
      selectedRuntime?.attributes?.git?.remotes?.origin
    ) {
      return;
    }
    setSelectedRuntime(runtime);
    setRuntimeSource((runtime.attributes?.git as any)?.remotes?.origin);
    setDetecting(true);
    setFieldValue('isDetected', false);
  };

  const [detectedComponents, detectionLoaded, detectionError] = useComponentDetection(
    runtimeSource,
    application,
    secret,
    sourceUrl !== runtimeSource ? undefined : context,
    revision,
  );

  const detectingRuntimeToggle = React.useCallback(
    (onToggle) => (
      <DropdownToggle
        onToggle={onToggle}
        isDisabled={detecting || !samplesLoaded}
        data-test="dropdown-toggle"
      >
        {selectedRuntime?.name && selectedRuntime?.name !== DetectingRuntime ? (
          selectedRuntime.name || 'Select a runtime'
        ) : (
          <Text component="p">
            <Spinner
              size="md"
              isSVG
              aria-label="detecting runtime"
              style={{ marginRight: 'var(--pf-global--spacer--xs)' }}
            />
            {DetectingRuntime}
          </Text>
        )}
      </DropdownToggle>
    ),
    [detecting, samplesLoaded, selectedRuntime],
  );

  React.useEffect(() => {
    if (
      isDetected &&
      samplesLoaded &&
      (!selectedRuntime || selectedRuntime.name === DetectingRuntime)
    ) {
      setSelectedRuntime(
        samples?.find(
          (s) => s.attributes.projectType === components[detectedComponentIndex]?.projectType,
        ) || { name: 'Other' },
      );
    } else if (!selectedRuntime) {
      setSelectedRuntime({ name: DetectingRuntime });
    }
  }, [components, detectedComponentIndex, isDetected, samples, samplesLoaded, selectedRuntime]);

  React.useEffect(() => {
    if (detectionError) {
      setDetecting(false);
      setFieldError(`${fieldPrefix}.runtime`, detectionError);
    } else if (detectionLoaded && detectedComponents) {
      setDetecting(false);
      // To avoid formik validating on old values due to a formik bug - https://github.com/jaredpalmer/formik/issues/2083
      setTimeout(() => setFieldValue('isDetected', true));
      setTimeout(() => setFieldValue('detectionFailed', false));
      const componentValues = transformComponentValues(detectedComponents)[0];
      const component = patchSourceUrl(componentValues.componentStub, sourceUrl);
      setFieldValue(`${fieldPrefix}.componentStub`, component);
      setFieldValue(`${fieldPrefix}.language`, componentValues.language);
    }
  }, [
    detectedComponentIndex,
    detectedComponents,
    detectionError,
    detectionLoaded,
    fieldPrefix,
    setFieldError,
    setFieldValue,
    sourceUrl,
  ]);

  // touch the dropdown field on load so validation error message can be shown
  React.useEffect(() => {
    setFieldTouched('runtime');
  }, [setFieldTouched]);

  return (
    <DropdownField
      name="runtime"
      label="Runtime"
      items={items}
      isDisabled={detecting || !samplesLoaded}
      placeholder="Select a runtime"
      value={selectedRuntime?.name}
      onChange={onChange}
      dropdownToggle={detectingRuntimeToggle}
    />
  );
};
