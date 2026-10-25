package com.dabubble.backend.storage

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import java.net.URI

/**
 * The plain AWS SDK against SeaweedFS, with path-style URLs (`<endpoint>/<bucket>/<key>`): the client on the
 * internal endpoint, the presigner on the browser-facing one.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(StorageProperties::class)
class StorageConfig {
    @Bean
    fun s3Client(properties: StorageProperties): S3Client =
        S3Client
            .builder()
            .endpointOverride(URI(properties.endpoint))
            .region(Region.of(properties.region))
            .credentialsProvider(credentials(properties))
            .forcePathStyle(true)
            .build()

    @Bean
    fun s3Presigner(properties: StorageProperties): S3Presigner =
        S3Presigner
            .builder()
            .endpointOverride(URI(properties.publicEndpoint))
            .region(Region.of(properties.region))
            .credentialsProvider(credentials(properties))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .build()

    private fun credentials(properties: StorageProperties) =
        StaticCredentialsProvider.create(AwsBasicCredentials.create(properties.accessKey, properties.secretKey))
}
