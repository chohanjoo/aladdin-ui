import * as React from 'react';
import { style } from 'typestyle';
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromises';
import { Response } from '../../services/Api';
import * as API from '../../services/Api';
import { InfraMetrics } from '../../types/Metrics';
import { DashboardPropType } from '../../types/Dashboard';
import { mergeInfraMetricsResponses } from './DashboardCommon';
import { InfraMetricsOptions } from '../../types/MetricsOptions';
import update from 'react-addons-update';
import { 
  Card,
  CardHeading,
  CardTitle,
} from 'patternfly-react';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import 'react-bootstrap-table/css/react-bootstrap-table.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { CardBody } from '@patternfly/react-core';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import { meshWideMTLSStatusSelector } from '../../store/Selectors';

const cardTitleStyle = style({ 
  fontSize: '25px',
  fontWeight: 600
});

type TableElement = {
  namespace: string[],
  name: string[],
  label: string[],
  pod: string[],
  creationTimestamp: string[]
};

type State = {
  replicaSetInfo: TableElement[];
};

/**
 * ReplicasetDetail: 쿠버네티스 레플리카 셋에 관한 정보를 불러온다. 다음은 해당 정보를 불러올 때 사용하는 쿼리와 이에 대한 설명이다.
 * - Namespace: 'kube_replicaset_labels' (전체 레플리카 셋을 가져오기 위해 사용한다.)
 * - Name: 'kube_replicaset_labels' (레플리카 셋의 이름을 가져오기 위해 사용한다.)
 * - Label: 'kube_replicaset_labels' (레플리카 셋의 라벨을 가져오기 위해 사용한다.)
 * - Available: 'kube_replicaset_status_replicas', 'kube_replicaset_status_ready_replicas' (사용 가능한 레플리카 셋들을 가져오기 위해 사용한다.)
 * - Create Timestamp: 'kube_replicaset_created' (레플리카 셋이 만들어진 시간을 가져오기 위해 사용한다.)
 */

class CardDetailReplicaset extends React.Component<DashboardPropType, State> {
  private metricsPromise?: CancelablePromise<Response<InfraMetrics>>;

  constructor(props: DashboardPropType) {
    super(props);
    this.state = {
      replicaSetInfo: [],
    };
  }

  componentWillMount() {
    this.load();
  }

  componentDidMount() {
    window.setInterval(this.load, 15000);
  }

  componentWillUnmount() {
    if (this.metricsPromise) {
      this.metricsPromise.cancel();
    }
  }

  load = () => {
    const optionsDeployment: InfraMetricsOptions = {
      filters: [
        'replicaset_labels', 
        'replicaset_created', 
        'replicaset_status_ready_replicas',
        'replicaset_status_replicas',
      ]
    };
    const promiseReplicaSet = API.getInfraMetrics(optionsDeployment);
    
    this.metricsPromise = makeCancelablePromise(mergeInfraMetricsResponses([promiseReplicaSet]));
    this.metricsPromise.promise
    .then(response => {
      const metrics = response.data.metrics;
      this.sortMetric(metrics);

      const replicaset_labels = metrics.replicaset_labels;
      const replicaset_created = metrics.replicaset_created;
      const replicaset_status_ready_replicas = metrics.replicaset_status_ready_replicas;
      const replicaset_status_replicas = metrics.replicaset_status_replicas;
      
      const replicaSetNamespaceLists = new Array();
      const replicaSetLists = new Array();
      const replicaSetLabelLists = new Array();
      const replicaSetPodLists = new Array();
      const replicaSetCreatedLists = new Array();
      const replicaSetInfoLists = new Array();

      for (let i = 0; i < replicaset_labels.matrix.length; i++) {
        replicaSetNamespaceLists.push(replicaset_labels.matrix[i].metric.namespace);
        replicaSetLists.push(replicaset_labels.matrix[i].metric.replicaset);
        if (Object.keys(replicaset_labels.matrix[i].metric).indexOf('label_app') > -1) {
          replicaSetLabelLists.push(replicaset_labels.matrix[i].metric.label_app);
        } else if (Object.keys(replicaset_labels.matrix[i].metric).indexOf('label_k8s_app') > -1) {
          replicaSetLabelLists.push(replicaset_labels.matrix[i].metric.label_k8s_app);
        } else if (Object.keys(replicaset_labels.matrix[i].metric).indexOf('k8s_app') > -1) {
          replicaSetLabelLists.push(replicaset_labels.matrix[i].metric.k8s_app);
        } else if (Object.keys(replicaset_labels.matrix[i].metric).indexOf('label_tier') > -1) {
          replicaSetLabelLists.push(replicaset_labels.matrix[i].metric.label_tier);
        } else {
          replicaSetLabelLists.push('-');
        }
        replicaSetPodLists.push(replicaset_status_ready_replicas.matrix[i].values.slice(-1)[0][1] 
                              + '/' + replicaset_status_replicas.matrix[i].values.slice(-1)[0][1]);
      }

      for (let i = 0; i < replicaset_created.matrix.length; i++) {
        const rawTimestamp = replicaset_created.matrix[i].values.slice(-1)[0][1] * 1000;
        const date = new Date(rawTimestamp);
        const year = date.getFullYear();
        const month = ((date.getMonth() + 1) < 10 ? '0' : '') + (date.getMonth() + 1);
        const day = (date.getDate() < 10 ? '0' : '') + date.getDate();
        const hour = (date.getHours() < 10 ? '0' : '') + date.getHours();
        const minute = (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
        const second = (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
        const timestamp = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
        replicaSetCreatedLists.push(timestamp);
      }

      for (let i = 0; i < replicaSetLists.length; i++) {
        replicaSetInfoLists.push({
          namespace: replicaSetNamespaceLists[i],
          name: replicaSetLists[i],
          label: replicaSetLabelLists[i],
          pod: replicaSetPodLists[i],
          creationTimestamp: replicaSetCreatedLists[i]
        });
      }

      this.setState({
        replicaSetInfo: update(
          this.state.replicaSetInfo,
          {
            $set: replicaSetInfoLists
          }
        ),
      });
    });
  }

  render() {
    return (
      <>
        <Card>
          <CardHeading>
            <CardTitle className={cardTitleStyle}>
              {'Replicaset Table'}
            </CardTitle>
          </CardHeading>
          <CardBody>
            <BootstrapTable data={this.state.replicaSetInfo} version="4" search={true} pagination={true}>
              <TableHeaderColumn dataField="namespace" dataAlign="center" dataSort={true}>Namespace</TableHeaderColumn>
              <TableHeaderColumn dataField="name" isKey={true} dataAlign="center" >Name</TableHeaderColumn>
              <TableHeaderColumn dataField="label" dataAlign="center">Label</TableHeaderColumn>
              <TableHeaderColumn dataField="pod" searchable={false} dataAlign="center">Pod</TableHeaderColumn>
              <TableHeaderColumn dataField="creationTimestamp" dataAlign="center" dataSort={true}>Creation Timestamp</TableHeaderColumn>
            </BootstrapTable>
          </CardBody>
        </Card>
      </>
    );
  }

  private sortMetric = (metrics) => {
    metrics.replicaset_labels.matrix.sort((a, b) => {
      return (a.metric.replicaset < b.metric.replicaset) ? -1 : (a.metric.replicaset > b.metric.replicaset) ? 1 : 0;
    });

    metrics.replicaset_created.matrix.sort((a, b) => {
      return (a.metric.replicaset < b.metric.replicaset) ? -1 : (a.metric.replicaset > b.metric.replicaset) ? 1 : 0;
    });

    metrics.replicaset_status_ready_replicas.matrix.sort((a, b) => {
      return (a.metric.replicaset < b.metric.replicaset) ? -1 : (a.metric.replicaset > b.metric.replicaset) ? 1 : 0;
    });

    metrics.replicaset_status_replicas.matrix.sort((a, b) => {
      return (a.metric.replicaset < b.metric.replicaset) ? -1 : (a.metric.replicaset > b.metric.replicaset) ? 1 : 0;
    });
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  meshStatus: meshWideMTLSStatusSelector(state)
});

const ReplicasetDetailContainer = connect( mapStateToProps )(CardDetailReplicaset);
export default ReplicasetDetailContainer;