import { Construct } from '@aws-cdk/core';
import { ICluster } from '@aws-cdk/aws-ecs';
import { IAutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import { AwsCustomResource, PhysicalResourceId, AwsCustomResourcePolicy } from '@aws-cdk/custom-resources';
import { PolicyStatement } from '@aws-cdk/aws-iam';

export interface EcsCapacityProviderProps {
  cluster: ICluster;
  clusterAsg?: IAutoScalingGroup;
  name: string;
  managedScaling?: {
    maxScalingStep?: number;
    minScalingStep?: number;
    targetCapacity?: number;
  };
  managedTerminationProtection?: boolean;
}

export class EcsCapacityProvider extends Construct {
  constructor(scope: Construct, id: string, props: EcsCapacityProviderProps) {
    super(scope, id);

    const { cluster, name, managedScaling = {}, managedTerminationProtection } = props;

    const clusterAsg = cluster.autoscalingGroup || props.clusterAsg;

    if (!clusterAsg) throw new Error('No AutoscalingGroup could not be found');

    const describeAsg = new AwsCustomResource(this, 'DescribeAsg', {
      onCreate: {
        service: 'AutoScaling',
        action: 'describeAutoScalingGroups',
        parameters: {
          AutoScalingGroupNames: [clusterAsg.autoScalingGroupName],
        },
        outputPath: 'AutoScalingGroups.0.AutoScalingGroupARN',
        physicalResourceId: PhysicalResourceId.of(`${name}Create`),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const capacity = new AwsCustomResource(this, 'CreateCapacity', {
      onCreate: {
        service: 'ECS',
        action: 'createCapacityProvider',
        parameters: {
          autoScalingGroupProvider: {
            autoScalingGroupArn: describeAsg.getResponseField('AutoScalingGroups.0.AutoScalingGroupARN'),
            managedScaling: {
              maximumScalingStepSize: managedScaling.maxScalingStep || 1,
              minimumScalingStepSize: managedScaling.minScalingStep || 1,
              status: 'ENABLED',
              targetCapacity: managedScaling.targetCapacity || 100,
            },
            managedTerminationProtection: managedTerminationProtection ? 'ENABLED' : 'DISABLED',
          },
          name: name,
        },
        physicalResourceId: PhysicalResourceId.of(`${name}Create`),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    capacity.grantPrincipal.addToPolicy(
      new PolicyStatement({
        actions: ['autoscaling:CreateOrUpdateTags'],
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      })
    );

    const capacityName = capacity.getResponseField('capacityProvider.name');

    new AwsCustomResource(this, 'RegisterCapacity', {
      onCreate: {
        service: 'ECS',
        action: 'putClusterCapacityProviders',
        parameters: {
          capacityProviders: [capacityName],
          cluster: cluster.clusterName,
          defaultCapacityProviderStrategy: [
            {
              capacityProvider: capacityName,
              base: 0,
              weight: 1,
            },
          ],
        },
        physicalResourceId: PhysicalResourceId.of(`${name}Register`),
      },
      onDelete: {
        service: 'ECS',
        action: 'putClusterCapacityProviders',
        parameters: {
          capacityProviders: [],
          cluster: cluster.clusterName,
          defaultCapacityProviderStrategy: [],
        },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }
}
