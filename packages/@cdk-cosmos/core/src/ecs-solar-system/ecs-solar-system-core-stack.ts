import { InstanceType, SecurityGroup, Peer } from '@aws-cdk/aws-ec2';
import { Cluster, ICluster, ClusterProps, AddCapacityOptions, CpuUtilizationScalingProps } from '@aws-cdk/aws-ecs';
import {
  ApplicationLoadBalancer,
  ApplicationListener,
  ApplicationProtocol,
  IApplicationLoadBalancer,
  IApplicationListener,
  ApplicationLoadBalancerProps,
  ContentType,
} from '@aws-cdk/aws-elasticloadbalancingv2';
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { ARecord, RecordTarget } from '@aws-cdk/aws-route53';
import { LoadBalancerTarget } from '@aws-cdk/aws-route53-targets';
import { AutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import { IGalaxyCore } from '../galaxy/galaxy-core-stack';
import {
  ISolarSystemCore,
  SolarSystemCoreStack,
  SolarSystemCoreStackProps,
} from '../solar-system/solar-system-core-stack';
import { addEcsEndpoints } from '../components/core-vpc';
import { RemoteCluster, RemoteAlb, RemoteApplicationListener } from '../helpers/remote';
import { ClassType } from '../helpers/utils';

export interface IEcsSolarSystemCore extends ISolarSystemCore {
  readonly cluster: ICluster;
  readonly alb: IApplicationLoadBalancer;
  readonly httpListener: IApplicationListener;
  readonly httpInternalListener: IApplicationListener;
  readonly httpsListener?: IApplicationListener;
  readonly httpsInternalListener?: IApplicationListener;
}

export interface EcsSolarSystemCoreProps extends SolarSystemCoreStackProps {
  clusterProps?: Partial<ClusterProps>;
  clusterCapacityProps?: Partial<AddCapacityOptions>;
  albProps?: Partial<ApplicationLoadBalancerProps>;
  listenerInboundCidr?: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const EcsSolarSystemCoreStackBuilder = (base: typeof SolarSystemCoreStack) => {
  class EcsSolarSystemCoreStack extends base implements IEcsSolarSystemCore {
    readonly cluster: Cluster;
    readonly clusterAutoScalingGroup: AutoScalingGroup;
    readonly alb: ApplicationLoadBalancer;
    readonly httpListener: ApplicationListener;
    readonly httpInternalListener: ApplicationListener;
    readonly httpsListener?: ApplicationListener;
    readonly httpsInternalListener?: ApplicationListener;

    constructor(galaxy: IGalaxyCore, id: string, props?: EcsSolarSystemCoreProps) {
      super(galaxy, id, {
        description: 'Cosmos EcsSolarSystem: Resources dependant on each App Env, like ECS & ALB',
        ...props,
      });

      const {
        listenerInboundCidr = '0.0.0.0/0',
        vpcProps = {},
        clusterProps = {},
        clusterCapacityProps = {},
        albProps = {},
      } = props || {};
      const { defaultEndpoints = true } = vpcProps;

      // Only add endpoints if this component owens the Vpc.
      if (this.vpc.node.scope === this) {
        if (defaultEndpoints) addEcsEndpoints(this.vpc);
      }

      this.cluster = new Cluster(this, 'Cluster', {
        containerInsights: true,
        ...clusterProps,
        clusterName: this.singletonId('Cluster'),
        vpc: this.vpc,
      });

      this.clusterAutoScalingGroup = this.cluster.addCapacity('Capacity', {
        vpcSubnets: { subnetGroupName: 'App' },
        instanceType: new InstanceType('t3.medium'),
        minCapacity: 1,
        maxCapacity: 5,
        ...clusterCapacityProps,
      });

      this.clusterAutoScalingGroup.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'));

      const albSecurityGroup =
        albProps.securityGroup ||
        new SecurityGroup(this, 'AlbSecurityGroup', {
          vpc: this.vpc,
          description: 'SecurityGroup for ALB.',
          allowAllOutbound: true,
        });

      this.alb = new ApplicationLoadBalancer(this, 'Alb', {
        vpcSubnets: { subnetGroupName: 'App' },
        ...albProps,
        vpc: this.vpc,
        securityGroup: albSecurityGroup,
        loadBalancerName: this.singletonId('Alb'),
      });

      new ARecord(this, 'AlbRecord', {
        zone: this.zone,
        target: RecordTarget.fromAlias(new LoadBalancerTarget(this.alb)),
      });

      this.httpListener = this.alb.addListener('HttpListener', {
        protocol: ApplicationProtocol.HTTP,
        open: false,
      });

      this.httpInternalListener = this.alb.addListener('HttpInternalListener', {
        protocol: ApplicationProtocol.HTTP,
        port: 8080,
        open: false,
      });

      if (this.certificate !== undefined) {
        this.httpsListener = this.alb.addListener('HttpsListener', {
          port: 443,
          protocol: ApplicationProtocol.HTTPS,
          certificates: [this.certificate],
          open: false,
        });
        this.httpsInternalListener = this.alb.addListener('HttpsInternalListener', {
          port: 8443,
          protocol: ApplicationProtocol.HTTPS,
          certificates: [this.certificate],
          open: false,
        });
        RemoteApplicationListener.export(this.httpsListener, this.singletonId('HttpsListener'));
        RemoteApplicationListener.export(this.httpsInternalListener, this.singletonId('HttpsInternalListener'));
      }

      [this.httpListener, this.httpInternalListener, this.httpsListener, this.httpsInternalListener]
        .filter(listener => listener)
        .forEach(listener => this.configureListener(listener as ApplicationListener, listenerInboundCidr));

      RemoteCluster.export(this.cluster, this.singletonId('Cluster'));
      RemoteAlb.export(this.alb, this.singletonId('Alb'));
      RemoteApplicationListener.export(this.httpListener, this.singletonId('HttpListener'));
      RemoteApplicationListener.export(this.httpInternalListener, this.singletonId('HttpInternalListener'));
    }

    private configureListener(listener: ApplicationListener, listenerInboundCidr?: string | null): void {
      listener.addFixedResponse('Default', {
        statusCode: '404',
        contentType: ContentType.TEXT_PLAIN,
        messageBody: 'Route Not Found.',
      });
      if (listenerInboundCidr) {
        listener.connections.allowDefaultPortFrom(Peer.ipv4(listenerInboundCidr));
      } else {
        listener.connections.allowDefaultPortFrom(Peer.anyIpv4());
      }
    }

    addCpuAutoScaling(props: Partial<CpuUtilizationScalingProps>): void {
      this.clusterAutoScalingGroup.scaleOnCpuUtilization('CpuScaling', {
        ...props,
        targetUtilizationPercent: 50,
      });
    }
  }

  return EcsSolarSystemCoreStack as ClassType<typeof EcsSolarSystemCoreStack>;
};

export const EcsSolarSystemCoreStack = EcsSolarSystemCoreStackBuilder(SolarSystemCoreStack);
