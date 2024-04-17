import React, { useState } from 'react';
import * as R from 'ramda';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { Add } from '@mui/icons-material';
import { graphql, createFragmentContainer } from 'react-relay';
import { Form, Formik, Field } from 'formik';
import MenuItem from '@mui/material/MenuItem';
import * as Yup from 'yup';
import Tooltip from '@mui/material/Tooltip';
import makeStyles from '@mui/styles/makeStyles';
import Fab from '@mui/material/Fab';
import { useFormatter } from '../../../../components/i18n';
import { commitMutation, MESSAGING$, QueryRenderer } from '../../../../relay/environment';
import { markingDefinitionsLinesSearchQuery } from '../../settings/marking_definitions/MarkingDefinitionsLines';
import SelectField from '../../../../components/SelectField';
import Loader from '../../../../components/Loader';
import { ExportContext } from '../../../../utils/ExportContextProvider';

// Deprecated - https://mui.com/system/styles/basics/
// Do not use it for new code.
const useStyles = makeStyles(() => ({
  createButton: {
    position: 'fixed',
    bottom: 30,
    right: 30,
    zIndex: 2000,
  },
}));

export const StixCoreObjectsExportCreationMutation = graphql`
  mutation StixCoreObjectsExportCreationMutation(
    $format: String!
    $exportType: String!
    $maxMarkingDefinition: String
    $exportContext: ExportContext
    $search: String
    $orderBy: StixCoreObjectsOrdering
    $orderMode: OrderingMode
    $filters: FilterGroup
    $selectedIds: [String]
  ) {
    stixCoreObjectsExportAsk(
      format: $format
      exportType: $exportType
      maxMarkingDefinition: $maxMarkingDefinition
      exportContext: $exportContext
      search: $search
      orderBy: $orderBy
      orderMode: $orderMode
      filters: $filters
      selectedIds: $selectedIds
    ) {
      id
    }
  }
`;

const exportValidation = (t) => Yup.object().shape({
  format: Yup.string().trim().required(t('This field is required')),
});

export const scopesConn = (exportConnectors) => {
  const scopes = R.uniq(
    R.flatten(R.map((c) => c.connector_scope, exportConnectors)),
  );
  const connectors = R.map((s) => {
    const filteredConnectors = R.filter(
      (e) => R.includes(s, e.connector_scope),
      exportConnectors,
    );
    return R.map(
      (x) => ({ data: { name: x.name, active: x.active } }),
      filteredConnectors,
    );
  }, scopes);
  const zipped = R.zip(scopes, connectors);
  return R.fromPairs(zipped);
};

const StixCoreObjectsExportCreationComponent = ({
  paginationOptions,
  exportContext,
  onExportAsk,
  data,
}) => {
  const { t_i18n } = useFormatter();
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const onSubmit = (selectedIds, values, { setSubmitting, resetForm }) => {
    const maxMarkingDefinition = values.maxMarkingDefinition === 'none'
      ? null
      : values.maxMarkingDefinition;
    commitMutation({
      mutation: StixCoreObjectsExportCreationMutation,
      variables: {
        exportContext,
        format: values.format,
        exportType: 'full',
        selectedIds,
        ...paginationOptions,
        maxMarkingDefinition,
      },
      onCompleted: () => {
        setSubmitting(false);
        resetForm();
        if (onExportAsk) onExportAsk();
        setOpen(false);
        MESSAGING$.notifySuccess('Export successfully started');
      },
    });
  };
  const connectorsExport = R.propOr([], 'connectorsForExport', data);
  const exportScopes = R.uniq(
    R.flatten(R.map((c) => c.connector_scope, connectorsExport)),
  );
  const exportConnsPerFormat = scopesConn(connectorsExport);
  // eslint-disable-next-line max-len
  const isExportActive = (format) => R.filter((x) => x.data.active, exportConnsPerFormat[format]).length > 0;
  const isExportPossible = R.filter((x) => isExportActive(x), exportScopes).length > 0;
  return (
    <ExportContext.Consumer>
      {({ selectedIds }) => {
        return (
          <>
            <Tooltip
              title={
                isExportPossible
                  ? t_i18n('Generate an export')
                  : t_i18n('No export connector available to generate an export')
              }
              aria-label="generate-export"
            >
              <Fab
                onClick={() => setOpen(true)}
                color="secondary"
                aria-label="Add"
                className={classes.createButton}
                disabled={!isExportPossible}
              >
                <Add />
              </Fab>
            </Tooltip>
            <Formik
              enableReinitialize={true}
              initialValues={{
                format: '',
                maxMarkingDefinition: 'none',
              }}
              validationSchema={exportValidation(t_i18n)}
              onSubmit={(values, { setSubmitting, resetForm }) => onSubmit(selectedIds, values, { setSubmitting, resetForm })
              }
              onReset={() => setOpen(false)}
            >
              {({ submitForm, handleReset, isSubmitting }) => (
                <Form>
                  <Dialog
                    PaperProps={{ elevation: 1 }}
                    open={open}
                    onClose={() => setOpen(false)}
                    fullWidth={true}
                  >
                    <DialogTitle>{t_i18n('Generate an export')}</DialogTitle>
                    <QueryRenderer
                      query={markingDefinitionsLinesSearchQuery}
                      variables={{ first: 200 }}
                      render={({ props }) => {
                        if (props && props.markingDefinitions) {
                          return (
                            <DialogContent>
                              <Field
                                component={SelectField}
                                variant="standard"
                                name="format"
                                label={t_i18n('Export format')}
                                fullWidth={true}
                                containerstyle={{ width: '100%' }}
                              >
                                {exportScopes.map((value, i) => (
                                  <MenuItem
                                    key={i}
                                    value={value}
                                    disabled={!isExportActive(value)}
                                  >
                                    {value}
                                  </MenuItem>
                                ))}
                              </Field>
                              <Field
                                component={SelectField}
                                variant="standard"
                                name="maxMarkingDefinition"
                                label={t_i18n('Max marking definition level')}
                                fullWidth={true}
                                containerstyle={{
                                  marginTop: 20,
                                  width: '100%',
                                }}
                              >
                                <MenuItem value="none">{t_i18n('None')}</MenuItem>
                                {R.map(
                                  (markingDefinition) => (
                                    <MenuItem
                                      key={markingDefinition.node.id}
                                      value={markingDefinition.node.id}
                                    >
                                      {markingDefinition.node.definition}
                                    </MenuItem>
                                  ),
                                  props.markingDefinitions.edges,
                                )}
                              </Field>
                            </DialogContent>
                          );
                        }
                        return <Loader variant="inElement" />;
                      }}
                    />
                    <DialogActions>
                      <Button onClick={handleReset} disabled={isSubmitting}>
                        {t_i18n('Cancel')}
                      </Button>
                      <Button
                        color="secondary"
                        onClick={submitForm}
                        disabled={isSubmitting}
                      >
                        {t_i18n('Create')}
                      </Button>
                    </DialogActions>
                  </Dialog>
                </Form>
              )}
            </Formik>
          </>
        );
      }}
    </ExportContext.Consumer>
  );
};

export default createFragmentContainer(StixCoreObjectsExportCreationComponent, {
  data: graphql`
    fragment StixCoreObjectsExportCreation_data on Query {
      connectorsForExport {
        id
        name
        active
        connector_scope
        updated_at
      }
    }
  `,
});
