import { Construct } from '@aws-cdk/core';
import { Role } from '@aws-cdk/aws-iam';
import { Project, IProject } from '@aws-cdk/aws-codebuild';
import { ISolarSystemExtension, SolarSystemExtensionStack } from '../../solar-system/solar-system-extension-stack';
import { BaseFeatureConstruct, BaseFeatureConstructProps } from '../../components/base';
import { CdkPipeline, CdkPipelineProps } from '@cosmos-building-blocks/pipeline';
import { CDK_PIPELINE_PATTERN } from './cicd-solar-system-core-stack';

export interface ICiCdFeatureExtension extends Construct {
  readonly solarSystem: ISolarSystemExtension;
  readonly deployProject?: IProject;
}

export interface CiCdFeatureExtensionStackProps extends BaseFeatureConstructProps {
  cdkPipelineProps?: Partial<CdkPipelineProps>;
}

export class CiCdFeatureExtensionStack extends BaseFeatureConstruct implements ICiCdFeatureExtension {
  readonly solarSystem: ISolarSystemExtension;
  readonly cdkPipeline: CdkPipeline;
  readonly deployProject: Project;

  constructor(solarSystem: ISolarSystemExtension, id: string, props?: CiCdFeatureExtensionStackProps) {
    super(solarSystem, id, props);

    const { cdkPipelineProps } = props || {};

    this.solarSystem = solarSystem;

    const cdkMasterRoleStaticArn = this.solarSystem.galaxy.cosmos.portal.cdkMasterRoleStaticArn;
    const cdkRepo = this.solarSystem.galaxy.cosmos.cdkRepo;

    this.cdkPipeline = new CdkPipeline(this, 'CdkPipeline', {
      deployRole: Role.fromRoleArn(this, 'CdkMasterRole', cdkMasterRoleStaticArn, {
        mutable: false,
      }),

      ...cdkPipelineProps,
      pipelineName: this.solarSystem.nodeId('Cdk-Pipeline', '-', CDK_PIPELINE_PATTERN),
      deployName: this.solarSystem.nodeId('Cdk-Deploy', '-', CDK_PIPELINE_PATTERN),
      cdkRepo: cdkRepo,
    });
    this.deployProject = this.cdkPipeline.deploy;
  }
}

declare module '../../solar-system/solar-system-extension-stack' {
  export interface ISolarSystemExtension {
    readonly ciCd?: ICiCdFeatureExtension;
  }

  interface SolarSystemExtensionStack {
    ciCd?: CiCdFeatureExtensionStack;
    addCiCd(props?: CiCdFeatureExtensionStackProps): CiCdFeatureExtensionStack;
  }
}

SolarSystemExtensionStack.prototype.addCiCd = function(
  props?: CiCdFeatureExtensionStackProps
): CiCdFeatureExtensionStack {
  this.ciCd = new CiCdFeatureExtensionStack(this, 'CiCd', props);
  return this.ciCd;
};
